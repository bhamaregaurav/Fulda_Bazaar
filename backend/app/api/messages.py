# ─── app/api/messages.py ──────────────────────────────────────────────────
from __future__ import annotations

from datetime import datetime
from datetime import timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.orm import selectinload
from app.models.listing_model import Listing, ListingImage

from app.core.database import get_db
from app.core.security  import get_current_user
from app.models.chat_models  import Conversation, Message
from app.models.user_models  import User
from app.core.ws_manager import WS_MANAGER
from app.repositories.messages import (
    create_message,
    get_conversation_page,
    count_unread,
)
from app.services.crypto   import decrypt
from app.services.toxicity import is_toxic
from app.utils.pagination  import PAGE_SIZE

router = APIRouter(prefix="/chats", tags=["Chats"])

# ────────────────────────────  Pydantic schemas  ──────────────────────────
class ListingInfo(BaseModel):
    listing_id: int
    title: str
    first_image: Optional[str] = None
class ChatPreview(BaseModel):
    conversation_id: int
    user_id: int
    first_name: str
    last_name: str
    last_message: str
    last_message_at: datetime
    unread_count: int
    listing_info: Optional[ListingInfo] = None
class MessageOut(BaseModel):
    message_id: int
    sender_id: int
    receiver_id: int
    text: str
    sent_at: datetime
    read_status: bool
    listing_info: Optional[ListingInfo] = None

class MessagesPage(BaseModel):
    messages: List[MessageOut]
    next_before_id: Optional[int] = None
    next_before_ts: Optional[datetime] = None

class SendMessageIn(BaseModel):
    # one of the next two is required
    conversation_id: Optional[int] = Field(
        None, description="existing conversation to append to"
    )
    receiver_id: Optional[int] = Field(
        None, description="target user when starting a NEW chat"
    )
    listing_id: Optional[int] = None
    text: str = Field(..., max_length=200)

class SendMessageOut(BaseModel):
    conversation_id: int
    message_id: int
    sent_at: datetime

# ───────────────────────────  helper functions  ───────────────────────────
async def _other_participant(conv: Conversation, my_id: int) -> int:
    """Return the *other* user's id or raise 403 if caller not in the convo."""
    if my_id == conv.user1_id:
        return conv.user2_id
    if my_id == conv.user2_id:
        return conv.user1_id
    raise HTTPException(status_code=403, detail="Not part of this conversation")

async def _find_or_create_conv(
    db: AsyncSession,
    me_id: int,
    other_id: int,
    listing_id: int | None,
) -> Conversation:
    """Find existing conversation between two users (+same listing) or create one."""
    stmt = select(Conversation).where(
        or_(
            and_(Conversation.user1_id == me_id,   Conversation.user2_id == other_id),
            and_(Conversation.user1_id == other_id, Conversation.user2_id == me_id),
        ),
        Conversation.listing_id == listing_id,
        Conversation.is_active.is_(True),
    )
    conv = (await db.execute(stmt)).scalars().first()
    if conv:
        return conv

    conv = Conversation(
        user1_id=me_id,
        user2_id=other_id,
        listing_id=listing_id,
    )
    db.add(conv)
    await db.flush()               # populates autoincrement PK
    return conv

# ──────────────────────────────  endpoints  ───────────────────────────────
@router.get("/preview", response_model=List[ChatPreview])
async def inbox(
    db: AsyncSession = Depends(get_db),
    me: User         = Depends(get_current_user),
):
    """Return one preview row per active conversation for the logged-in user."""
    stmt = (
        select(Conversation)
        .where(
            or_(Conversation.user1_id == me.user_id,
                Conversation.user2_id == me.user_id),
            Conversation.is_active.is_(True),
        )
        .order_by(Conversation.last_message_at.desc())
    )
    convs: list[Conversation] = (await db.execute(stmt)).scalars().all()
    previews: list[ChatPreview] = []

    for conv in convs:
        other_id = await _other_participant(conv, me.user_id)
        other: User | None = await db.get(User, other_id)
        if other is None:
            continue                          # other user deleted?
        listing_info = None
        if conv.listing_id:
            result = await db.execute(
                select(Listing)
                .options(selectinload(Listing.images))
                .where(Listing.listing_id == conv.listing_id)
            )
            listing = result.scalar_one_or_none()
            if listing:
                first_image = None
                if listing.images:
                    # Get the first image (or primary image)
                    first_image = next(
                        (img.image_path for img in listing.images if img.is_primary),
                        listing.images[0].image_path if listing.images else None
                    )
                
                listing_info = ListingInfo(
                    listing_id=listing.listing_id,
                    title=listing.title,
                    first_image=first_image
                )
        # fetch last message (fast: 1-row query)
        last_stmt = (
            select(Message)
            .where(Message.conversation_id == conv.conversation_id)
            .order_by(Message.sent_at.desc())
            .limit(1)
        )
        last: Message | None = (await db.execute(last_stmt)).scalars().first()

        last_msg_txt = decrypt(last.ciphertext, last.nonce) if last else ""
        last_ts      = last.sent_at if last else conv.created_at
        unread_cnt   = await count_unread(
            db,
            conversation_id=conv.conversation_id,
            user_id=me.user_id,
        )

        previews.append(
            ChatPreview(
                conversation_id = conv.conversation_id,
                user_id         = other.user_id,
                first_name      = other.first_name,
                last_name       = other.last_name,
                last_message    = last_msg_txt,
                last_message_at = last_ts,
                unread_count    = unread_cnt,
                listing_info    = listing_info,
            )
        )
    return previews


@router.get("/individual/{conversation_id}", response_model=MessagesPage)
async def get_history(
    conversation_id: int,
    before_id: int | None = Query(None),
    before_ts: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
    me: User         = Depends(get_current_user),
):
    """Return a page (≤ 50 msgs) of the conversation, newest-first pagination."""
    conv: Conversation | None = await db.get(Conversation, conversation_id)
    if not conv or not conv.is_active:
        raise HTTPException(404, "Conversation not found")
    await _other_participant(conv, me.user_id)          # membership check

    msgs = await get_conversation_page(
        db,
        conversation_id=conversation_id,
        before_id=before_id,
        before_ts=before_ts,
        limit=PAGE_SIZE,
    )
     # Get listing info if conversation has a listing_id
    listing_info = None
    if conv.listing_id:
        result = await db.execute(
            select(Listing)
            .options(selectinload(Listing.images))
            .where(Listing.listing_id == conv.listing_id)
        )
        listing = result.scalar_one_or_none()
        if listing:
            first_image = None
            if listing.images:
                # Get the first image (or primary image)
                first_image = next(
                    (img.image_path for img in listing.images if img.is_primary),
                    listing.images[0].image_path if listing.images else None
                )
            
            listing_info = ListingInfo(
                listing_id=listing.listing_id,
                title=listing.title,
                first_image=first_image
            )
    out: list[MessageOut] = []
    for msg in msgs:
        text = decrypt(msg.ciphertext, msg.nonce)
        out.append(
            MessageOut(
                message_id   = msg.message_id,
                sender_id    = msg.sender_id,
                receiver_id  = msg.receiver_id,
                text         = text,
                sent_at      = msg.sent_at,
                read_status  = msg.read_status,
                listing_info = listing_info,
            )
        )

        # mark as read (only for recipient)
        if msg.receiver_id == me.user_id and not msg.read_status:
            msg.read_status = True
            msg.read_at = datetime.now(timezone.utc)

    await db.commit()

    next_before_id = out[0].message_id if out else None
    next_before_ts = out[0].sent_at     if out else None

    return MessagesPage(
        messages       = out,
        next_before_id = next_before_id,
        next_before_ts = next_before_ts,
    )


@router.post("/send", response_model=SendMessageOut, status_code=status.HTTP_201_CREATED)
async def send_message(
    body: SendMessageIn,
    db: AsyncSession = Depends(get_db),
    me: User         = Depends(get_current_user),
):
    if (body.conversation_id is None) == (body.receiver_id is None):
        raise HTTPException(
            400,
            "Provide **either** conversation_id (existing chat) **or** receiver_id (new chat)",
        )

    if await is_toxic(body.text):
        raise HTTPException(422, "Toxic content")

    if body.conversation_id is not None:
        conv: Conversation | None = await db.get(Conversation, body.conversation_id)
        if not conv or not conv.is_active:
            raise HTTPException(404, "Conversation not found")
        receiver_id = await _other_participant(conv, me.user_id)


    else:
        if body.receiver_id == me.user_id:
            raise HTTPException(400, "Cannot chat with yourself")
        receiver = await db.get(User, body.receiver_id)
        if receiver is None:
            raise HTTPException(404, "Receiver not found")

        conv = await _find_or_create_conv(
            db,
            me_id    = me.user_id,
            other_id = body.receiver_id,
            listing_id = body.listing_id,
        )
        receiver_id = body.receiver_id

    msg = await create_message(
        db              = db,
        conversation_id = conv.conversation_id,
        sender_id       = me.user_id,
        receiver_id     = receiver_id,
        plaintext       = body.text,
        listing_id      = conv.listing_id,
    )

    conv.last_message_at = msg.sent_at
    await db.commit()

    await WS_MANAGER.broadcast_room(
        conv.conversation_id,
        {
            "event": "new_message",
            "conversation_id": conv.conversation_id,
            "message": {
                "message_id": msg.message_id,
                "sender_id":  msg.sender_id,
                "receiver_id": msg.receiver_id,
                "text":       body.text,        # already on server, no extra decrypt
                "sent_at":    msg.sent_at.isoformat(),
                "listing_info": listing_info.dict() if listing_info else None,
            },
        },
    )
    '''chat_evt = {
        "type": "chat",
        "conversation_id": conv.conversation_id,
        "message_id": msg.message_id,
        "sender_id":  msg.sender_id,
        "text":       body.text,
        "sent_at":    msg.sent_at.isoformat(),
    }'''
    preview_evt = {
        "type": "preview",
        "conversation_id": conv.conversation_id,
        "last_text": body.text[:80],
        "sender_id":  msg.sender_id,
        "receiver_id": receiver_id,
        "sent_at":    msg.sent_at.isoformat(),
        "user_id":    msg.sender_id,
        "first_name": me.first_name,
        "last_name":  me.last_name,
    }

    #await WS_MANAGER.broadcast_room(conv.conversation_id, chat_evt)

    await WS_MANAGER.send_to_user(receiver_id, preview_evt)

    return SendMessageOut(
        conversation_id = conv.conversation_id,
        message_id      = msg.message_id,
        sent_at         = msg.sent_at,
    )
