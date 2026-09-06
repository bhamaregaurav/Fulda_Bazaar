from __future__ import annotations
from datetime import datetime
from typing import Sequence

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_models import Message
from app.utils.pagination import add_cursor, PAGE_SIZE
from app.services.crypto import encrypt

async def create_message(
    db: AsyncSession,
    *,
    conversation_id: int,
    sender_id: int,
    receiver_id: int,
    plaintext: str,
    listing_id: int | None = None,
) -> Message:
   
    ciphertext, nonce = encrypt(plaintext)

    msg = Message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        receiver_id=receiver_id,
        listing_id=listing_id,
        ciphertext=ciphertext,
        nonce=nonce,
    )

    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg

async def get_conversation_page(
    db: AsyncSession,
    *,
    conversation_id: int,
    before_id: int | None = None,
    before_ts: datetime | None = None,
    limit: int = PAGE_SIZE,
) -> Sequence[Message]:
    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.sent_at.desc()) 
    )
    stmt = add_cursor(stmt, before_id=before_id, before_ts=before_ts, limit=limit)

    result = await db.execute(stmt)
    page = list(result.scalars())

    return list(reversed(page))

async def count_unread(
    db: AsyncSession,
    *,
    conversation_id: int,
    user_id: int,
) -> int:
    stmt = (                                          
        select(func.count())
        .select_from(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.receiver_id == user_id,
            Message.read_status.is_(False), 
        )
    )
    result = await db.execute(stmt)
    return result.scalar() or 0 
