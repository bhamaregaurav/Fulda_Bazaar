from __future__ import annotations

import json
from collections import defaultdict
from typing import DefaultDict, Set
from datetime import timezone ,datetime
from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
    Depends,
    Query,
    HTTPException,
)
from jose import JWTError, jwt
from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.chat_models import Conversation, Message
from app.models.user_models import User
from app.repositories.messages import count_unread, create_message
from app.services.toxicity import is_toxic
from sqlalchemy import func
from app.core.ws_manager import WS_MANAGER

router = APIRouter()
rooms: DefaultDict[int, Set[WebSocket]] = defaultdict(set)   # key = conversation_id
user_sockets: DefaultDict[int, Set[WebSocket]] = defaultdict(set)  # key = user_id

async def _other_participant(conv: Conversation, my_id: int) -> int:
    """Return the *other* user's id - raise if caller not member."""
    if my_id == conv.user1_id:
        return conv.user2_id
    if my_id == conv.user2_id:
        return conv.user1_id
    raise HTTPException(403, "Not part of this conversation")


async def _current_user_ws(
    token: str = Query(..., description="JWT from /auth/login"),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        sub = payload.get("sub")
    except JWTError:
        raise HTTPException(403, "Invalid websocket token")

    if not sub:
        raise HTTPException(403, "Malformed token")

    result = await db.execute(select(User).where(User.email == sub))
    user = result.scalars().first()
    if not user:
        raise HTTPException(403, "User not found")
    return user


@router.websocket("/ws")
async def websocket_endpoint(
    ws: WebSocket,
    me: User = Depends(_current_user_ws),
    db: AsyncSession = Depends(get_db),
):
    
    joined: Set[int] = set()                 # rooms this socket has joined
    await WS_MANAGER.connect_user(me.user_id, ws)
    user_sockets[me.user_id].add(ws)         # all sockets of this user
    try:
        while True:
            raw = await ws.receive_text()
            try:
                req = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"error": "invalid JSON"})
                continue

            cmd      = req.get("cmd")
            conv_id  = req.get("conversation_id")

            
            if cmd == "join":
                if not isinstance(conv_id, int):
                    await ws.send_json({"error": "conversation_id required"})
                    continue

                # basic membership check (optional but nice)
                conv: Conversation | None = await db.get(Conversation, conv_id)
                if not conv or not conv.is_active:
                    await ws.send_json({"error": "Conversation not found"})
                    continue
                await _other_participant(conv, me.user_id)   # raises if stranger

                rooms[conv_id].add(ws)
                joined.add(conv_id)
                WS_MANAGER.join_room(conv_id, ws)
                await ws.send_json({"ok": f"joined {conv_id}"})

            elif cmd == "leave":
                if conv_id in joined:
                    rooms[conv_id].discard(ws)
                    joined.discard(conv_id)
                    WS_MANAGER.leave_room(conv_id, ws)
                await ws.send_json({"ok": f"left {conv_id}"})

            elif cmd == "send":
                text = req.get("text", "").strip()
                if not isinstance(conv_id, int) or not text:
                    await ws.send_json({"error": "conversation_id & text required"})
                    continue

                #if await is_toxic(text):
                    #await ws.send_json({"error": "Toxic content blocked"})
                    #continue

                # who is the receiver?
                conv: Conversation | None = await db.get(Conversation, conv_id)
                if not conv or not conv.is_active:
                    await ws.send_json({"error": "Conversation not found"})
                    continue
                receiver_id = await _other_participant(conv, me.user_id)

                msg = await create_message(
                    db              = db,
                    conversation_id = conv_id,
                    sender_id       = me.user_id,
                    receiver_id     = receiver_id,
                    plaintext       = text,
                    listing_id      = conv.listing_id,
                )

                # update convo newest-timestamp
                conv.last_message_at = msg.sent_at
                await db.commit()

                # full chat bubble
                chat_evt = {
                    "type": "chat",
                    "conversation_id": conv_id,
                    "message_id": msg.message_id,
                    "sender_id": me.user_id,
                    "text": text,
                    "sent_at": msg.sent_at.isoformat(),
                }

                # thin sidebar preview
                preview_evt = {
                    "type": "preview",
                    "conversation_id": conv_id,
                    "last_text": text[:80],
                    "sender_id": me.user_id,
                    "receiver_id": receiver_id,
                    "sent_at": msg.sent_at.isoformat(),
                    "user_id": me.user_id,  # Add sender's user_id for new conversations
                    "first_name": me.first_name,  # Include sender's name for new chats
                    "last_name": me.last_name,
                    "unread_count": await count_unread(
                        db, conversation_id=conv_id, user_id=receiver_id
                    )
                }

                # broadcast to room members
                '''dead_room_sockets: list[WebSocket] = []
                for sock in rooms[conv_id]:
                    try:
                        await sock.send_json(chat_evt)
                    except RuntimeError:
                        dead_room_sockets.append(sock)
                '''

                await ws.send_json(chat_evt)                    # echo to sender
                for sock in list(rooms[conv_id]):
                    if sock is not ws:
                        await sock.send_json(chat_evt)

                dead_user_sockets: list[WebSocket] = []

                for sock in list(user_sockets[receiver_id]):
                    if sock not in rooms[conv_id]:
                        try:
                            await sock.send_json(chat_evt)     # first bubble
                            await sock.send_json(preview_evt)  # sidebar line
                        except RuntimeError:
                            dead_user_sockets.append(sock)

                # clean up broken sockets
                for sock in dead_user_sockets:
                    user_sockets[receiver_id].discard(sock)

            elif cmd == "read":
                if not isinstance(conv_id, int):
                    await ws.send_json({"error": "conversation_id required"})
                    continue

                await db.execute(
                    update(Message)
                    .where(
                        (Message.conversation_id == conv_id)
                        & (Message.receiver_id == me.user_id)
                        & (Message.read_status.is_(False))
                    )
                    .values(read_status=True,
                            read_at=func.now())
                )
                await db.commit()
                await ws.send_json({"ok": f"read up to now in {conv_id}"})

                for sock in rooms[conv_id]:
                    if sock is not ws:
                        await sock.send_json(
                            {
                                "type": "read-receipt",
                                "conversation_id": conv_id,
                                "reader_id": me.user_id,
                                "read_at":    datetime.now(timezone.utc).isoformat(),
                            }
                        )

            else:
                await ws.send_json({"error": f"unknown cmd '{cmd}'"})

    except WebSocketDisconnect:
        pass
    finally:
        for cid in joined:
            rooms[cid].discard(ws)
            WS_MANAGER.leave_room(cid, ws)
        user_sockets[me.user_id].discard(ws)
        WS_MANAGER.disconnect_user(me.user_id, ws)
