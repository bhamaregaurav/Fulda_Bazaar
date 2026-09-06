from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json
import asyncio
from datetime import datetime
from app.services.language_partner_matcher import matcher, PartnerRequest

router = APIRouter()

# Store active WebSocket connections
active_connections: Dict[str, WebSocket] = {}
user_sessions: Dict[str, Dict] = {}

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        print(f"Client {client_id} connected via WebSocket")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        print(f"Client {client_id} disconnected")

    async def send_personal_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_text(json.dumps(message))
            except Exception as e:
                print(f"DEBUG: Error sending message to {client_id}: {str(e)}")
                # Connection might be closed, remove it
                self.disconnect(client_id)

    async def send_to_room(self, message: dict, room_id: str):
        room_sockets = matcher.get_room_sockets(room_id)
        for socket_id in room_sockets:
            await self.send_personal_message(message, socket_id)

manager = ConnectionManager()

@router.websocket("/ws/language-partner/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    print(f"DEBUG: WebSocket connection attempt from {client_id}")
    try:
        # Check if client_id is already connected
        if client_id in manager.active_connections:
            print(f"DEBUG: Client {client_id} already has an active connection, closing old one")
            old_websocket = manager.active_connections[client_id]
            try:
                await old_websocket.close(code=1000, reason="New connection established")
            except Exception as e:
                print(f"DEBUG: Error closing old connection for {client_id}: {e}")
            manager.disconnect(client_id)
            matcher.remove_socket(client_id)
        
        await manager.connect(websocket, client_id)
        print(f"DEBUG: WebSocket connected successfully for {client_id}")
        
        while True:
            try:
                data = await websocket.receive_text()
                print(f"DEBUG: Received WebSocket data from {client_id}: {data}")
                message = json.loads(data)
                print(f"DEBUG: Parsed message: {message}")
                
                await handle_websocket_message(client_id, message, websocket)
            except WebSocketDisconnect as e:
                print(f"DEBUG: WebSocket disconnect in receive loop for {client_id}: {e.code}")
                # Handle disconnect inside the loop
                break
            except Exception as e:
                print(f"DEBUG: Error processing message from {client_id}: {e}")
                try:
                    await manager.send_personal_message({
                        "type": "error",
                        "message": f"Error processing message: {str(e)}"
                    }, client_id)
                except Exception as send_error:
                    print(f"DEBUG: Failed to send error message to {client_id}: {send_error}")
                    break  # Break the loop if we can't send messages
                
    except WebSocketDisconnect as e:
        print(f"DEBUG: WebSocket disconnect for {client_id}: {e.code}")
    except Exception as e:
        print(f"DEBUG: Unexpected error in websocket endpoint for {client_id}: {e}")
    finally:
        # Always clean up resources when the connection ends
        print(f"DEBUG: Cleaning up resources for {client_id}")
        # Look the room up BEFORE remove_socket() drops the socket->room entry,
        # otherwise the partner never gets the "user_left" notice.
        room_id = matcher.get_room_by_socket(client_id)
        manager.disconnect(client_id)
        matcher.remove_socket(client_id)

        # Notify partner if in a room
        if room_id:
            try:
                await manager.send_to_room({
                    "type": "user_left",
                    "message": "Your partner has left the session"
                }, room_id)
            except Exception as e:
                print(f"DEBUG: Error notifying room {room_id} about {client_id} leaving: {e}")
        
        if client_id in user_sessions:
            del user_sessions[client_id]

async def handle_websocket_message(client_id: str, message: dict, websocket: WebSocket):
    try:
        message_type = message.get("type")
        if not message_type:
            print(f"DEBUG: Message from {client_id} has no type: {message}")
            await manager.send_personal_message({
                "type": "error",
                "message": "Message has no type"
            }, client_id)
            return
            
        print(f"DEBUG: Handling message type '{message_type}' from client {client_id}")
        
        # Check if client is still connected
        if client_id not in manager.active_connections:
            print(f"DEBUG: Ignoring message from disconnected client {client_id}")
            return
        
        if message_type == "find_partner":
            await handle_find_partner(client_id, message.get("data", {}))
        
        elif message_type == "join_room":
            await handle_join_room(client_id, message.get("data", {}))
        
        elif message_type == "webrtc_offer":
            await handle_webrtc_signal(client_id, message, "webrtc_offer")
        
        elif message_type == "webrtc_answer":
            await handle_webrtc_signal(client_id, message, "webrtc_answer")
        
        elif message_type == "webrtc_ice_candidate":
            await handle_webrtc_signal(client_id, message, "webrtc_ice_candidate")
        
        elif message_type == "chat_message":
            await handle_chat_message(client_id, message.get("data", {}))
        
        else:
            await manager.send_personal_message({
                "type": "error",
                "message": f"Unknown message type: {message_type}"
            }, client_id)
    except Exception as e:
        print(f"DEBUG: Error in handle_websocket_message for {client_id}: {e}")
        try:
            await manager.send_personal_message({
                "type": "error",
                "message": "Server error processing your message"
            }, client_id)
        except Exception:
            # If we can't send a message, the client is probably disconnected
            pass

async def handle_find_partner(client_id: str, data: dict):
    try:
        preferences = data.get("preferences", {})
        user_id = data.get("user_id", client_id)
        
        print(f"DEBUG: Handling find_partner for client {client_id}")
        print(f"DEBUG: Preferences received: {preferences}")
        
        # Create partner request
        request = PartnerRequest(
            user_id=user_id,
            mode=preferences.get("mode", "learn"),
            target_language=preferences.get("targetLanguage", ""),
            instruction_language=preferences.get("instructionLanguage", ""),
            socket_id=client_id,
            timestamp=datetime.utcnow()
        )
        
        print(f"DEBUG: Created request: mode={request.mode}, target={request.target_language}, instruction={request.instruction_language}")
        
        # Store user session
        user_sessions[client_id] = {
            "user_id": user_id,
            "preferences": preferences
        }
        
        # Try to find a match
        room_id = matcher.add_request(request)
        
        print(f"DEBUG: Matcher returned room_id: {room_id}")
        
        if room_id:
            # Found a match!
            room_sockets = matcher.get_room_sockets(room_id)
            
            print(f"DEBUG: Match found! Room {room_id} created with {len(room_sockets)} users: {room_sockets}")
            
            # Notify both users about the match
            await manager.send_to_room({
                "type": "match_found",
                "data": {
                    "room_id": room_id,
                    "message": "Partner found! Starting video call..."
                }
            }, room_id)
            
            print(f"Match found! Room {room_id} created with {len(room_sockets)} users")
        else:
            # No match yet
            await manager.send_personal_message({
                "type": "waiting_for_partner",
                "data": {
                    "message": "Searching for a compatible partner..."
                }
            }, client_id)
            
            print(f"DEBUG: No match found. Client {client_id} added to waiting queue")
            print(f"DEBUG: Current pending requests: {list(matcher.pending_requests.keys())}")
            
    except Exception as e:
        print(f"Error in handle_find_partner: {e}")
        await manager.send_personal_message({
            "type": "error",
            "message": "Error finding partner"
        }, client_id)

async def handle_join_room(client_id: str, data: dict):
    """Handle user joining an existing room"""
    try:
        room_id = data.get("room_id")
        user_id = data.get("user_id", client_id)
        
        print(f"DEBUG: User {client_id} trying to join room {room_id}")
        
        if not room_id:
            await manager.send_personal_message({
                "type": "error",
                "message": "No room ID provided"
            }, client_id)
            return
        
        # Check if room exists
        room_sockets = matcher.get_room_sockets(room_id)
        
        if room_id not in matcher.active_rooms:
            print(f"DEBUG: Room {room_id} not found, creating new room")
            # Room doesn't exist, create it (this handles reconnection scenarios)
            matcher.active_rooms[room_id] = {client_id}
            matcher.socket_to_room[client_id] = room_id
        elif len(room_sockets) < 2:
            print(f"DEBUG: Adding user to existing room {room_id}")
            # Add to existing room
            matcher.active_rooms[room_id].add(client_id)
            matcher.socket_to_room[client_id] = room_id
        else:
            print(f"DEBUG: Room {room_id} is full")
            await manager.send_personal_message({
                "type": "error",
                "message": "Room is full"
            }, client_id)
            return
        
        # Store user session
        user_sessions[client_id] = {
            "user_id": user_id,
            "room_id": room_id
        }
        
        # Notify all users in the room that someone joined
        updated_room_sockets = matcher.get_room_sockets(room_id)
        print(f"DEBUG: Room {room_id} now has {len(updated_room_sockets)} users: {updated_room_sockets}")
        
        await manager.send_to_room({
            "type": "room_joined",
            "data": {
                "room_id": room_id,
                "user_count": len(updated_room_sockets),
                "message": f"User joined room. {len(updated_room_sockets)}/2 users connected."
            }
        }, room_id)
        
        # If room is full (2 users), start WebRTC signaling
        if len(updated_room_sockets) == 2:
            print(f"DEBUG: Room {room_id} is full, ready for WebRTC")
            
            # Get a list of socket IDs in the room
            room_sockets_list = list(updated_room_sockets)
            
            # The first socket in the room will be the initiator
            initiator_socket = room_sockets_list[0]
            responder_socket = room_sockets_list[1]
            
            print(f"DEBUG: Designating {initiator_socket} as WebRTC initiator")
            
            # Send ready_for_webrtc message to initiator
            await manager.send_personal_message({
                "type": "ready_for_webrtc",
                "data": {
                    "room_id": room_id,
                    "should_create_offer": True,
                    "message": "Both users connected, starting video call as initiator..."
                }
            }, initiator_socket)
            
            # Send ready_for_webrtc message to responder
            await manager.send_personal_message({
                "type": "ready_for_webrtc",
                "data": {
                    "room_id": room_id,
                    "should_create_offer": False,
                    "message": "Both users connected, waiting for initiator..."
                }
            }, responder_socket)
        
    except Exception as e:
        print(f"Error in handle_join_room: {e}")
        await manager.send_personal_message({
            "type": "error",
            "message": "Error joining room"
        }, client_id)

async def handle_webrtc_signal(client_id: str, message: dict, signal_type: str):
    """Forward WebRTC signaling messages to partner"""
    room_id = matcher.get_room_by_socket(client_id)
    if room_id:
        # Forward to other users in the room
        room_sockets = matcher.get_room_sockets(room_id)
        for socket_id in room_sockets:
            if socket_id != client_id:  # Don't send back to sender
                await manager.send_personal_message({
                    "type": signal_type,
                    "data": message.get("data", {})
                }, socket_id)

async def handle_chat_message(client_id: str, data: dict):
    """Handle chat messages between partners"""
    room_id = matcher.get_room_by_socket(client_id)
    if room_id:
        message_data = {
            "type": "chat_message",
            "data": {
                "text": data.get("text", ""),
                "timestamp": datetime.utcnow().isoformat(),
                "sender": client_id
            }
        }
        
        # Send to other users in the room (not the sender)
        room_sockets = matcher.get_room_sockets(room_id)
        for socket_id in room_sockets:
            if socket_id != client_id:
                await manager.send_personal_message(message_data, socket_id)