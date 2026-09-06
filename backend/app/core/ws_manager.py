from __future__ import annotations
from collections import defaultdict
from typing import DefaultDict, Set

from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState


class ConnectionManager:
    
    def __init__(self) -> None:
        self._user_sockets:   DefaultDict[int, Set[WebSocket]] = defaultdict(set)
        self._room_sockets:   DefaultDict[int, Set[WebSocket]] = defaultdict(set)

    async def connect_user(self, user_id: int, ws: WebSocket) -> None:
        await ws.accept()
        self._user_sockets[user_id].add(ws)

    def disconnect_user(self, user_id: int, ws: WebSocket) -> None:
        self._user_sockets[user_id].discard(ws)

    async def send_to_user(self, user_id: int, payload: dict) -> None:
        for sock in list(self._user_sockets[user_id]):
            if sock.application_state is WebSocketState.CONNECTED:
                await sock.send_json(payload)

    def join_room(self, room_id: int, ws: WebSocket) -> None:
        self._room_sockets[room_id].add(ws)

    def leave_room(self, room_id: int, ws: WebSocket) -> None:
        self._room_sockets[room_id].discard(ws)

    async def broadcast_room(self, room_id: int, payload: dict) -> None:
        for sock in list(self._room_sockets[room_id]):
            if sock.application_state is WebSocketState.CONNECTED:
                await sock.send_json(payload)

WS_MANAGER = ConnectionManager()