import socketio
from typing import Dict, Set
import asyncio
import json
from datetime import datetime
from app.services.language_partner_matcher import matcher, PartnerRequest

# Create Socket.IO server
sio = socketio.AsyncServer(
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True
)

# Store user sessions: sid -> user_info mapping
user_sessions: Dict[str, Dict] = {}

@sio.event
async def connect(sid, environ):
    """Handle client connection"""
    print(f"Client {sid} connected")
    await sio.emit('connected', {'message': 'Connected to language partner server'}, room=sid)

@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    print(f"Client {sid} disconnected")
    
    # Get room and notify partner
    room_id = matcher.get_room_by_socket(sid)
    if room_id:
        # Notify other users in the room that partner left
        await sio.emit('user-left', room=room_id, skip_sid=sid)
    
    # Remove from matcher
    matcher.remove_socket(sid)
    
    # Remove from user sessions
    if sid in user_sessions:
        del user_sessions[sid]

@sio.event
async def find_partner(sid, data):
    """Handle partner matching request"""
    print(f"Client {sid} looking for partner: {data}")
    
    try:
        # Extract partner preferences
        preferences = data.get('preferences', {})
        user_id = data.get('user_id', sid)  # Use socket ID as fallback
        
        # Create partner request
        request = PartnerRequest(
            user_id=user_id,
            mode=preferences.get('mode', 'learn'),
            target_language=preferences.get('targetLanguage', ''),
            instruction_language=preferences.get('instructionLanguage', ''),
            socket_id=sid,
            timestamp=datetime.utcnow()
        )
        
        # Store user session info
        user_sessions[sid] = {
            'user_id': user_id,
            'preferences': preferences
        }
        
        # Try to find a match
        room_id = matcher.add_request(request)
        
        if room_id:
            # Found a match! Join both users to the room
            room_sockets = matcher.get_room_sockets(room_id)
            
            for socket_id in room_sockets:
                await sio.enter_room(socket_id, room_id)
            
            # Notify both users about the match
            await sio.emit('match_found', {
                'room_id': room_id,
                'message': 'Partner found! Starting video call...'
            }, room=room_id)
            
            print(f"Match found! Room {room_id} created with {len(room_sockets)} users")
            
        else:
            # No match yet, user is in waiting state
            await sio.emit('waiting_for_partner', {
                'message': 'Searching for a compatible partner...'
            }, room=sid)
            
            print(f"Client {sid} added to waiting queue")
            
    except Exception as e:
        print(f"Error in find_partner: {e}")
        await sio.emit('error', {'message': 'Error finding partner'}, room=sid)

@sio.event
async def offer(sid, data):
    """Handle WebRTC offer"""
    room_id = data.get('roomId')
    offer = data.get('offer')
    
    if not room_id or not offer:
        await sio.emit('error', {'message': 'Room ID and offer are required'}, room=sid)
        return
    
    # Forward offer to other users in the room
    await sio.emit('offer', {'offer': offer}, room=room_id, skip_sid=sid)

@sio.event
async def answer(sid, data):
    """Handle WebRTC answer"""
    room_id = data.get('roomId')
    answer = data.get('answer')
    
    if not room_id or not answer:
        await sio.emit('error', {'message': 'Room ID and answer are required'}, room=sid)
        return
    
    # Forward answer to other users in the room
    await sio.emit('answer', {'answer': answer}, room=room_id, skip_sid=sid)

@sio.event
async def ice_candidate(sid, data):
    """Handle ICE candidate"""
    room_id = data.get('roomId')
    candidate = data.get('candidate')
    
    if not room_id or not candidate:
        await sio.emit('error', {'message': 'Room ID and candidate are required'}, room=sid)
        return
    
    # Forward ICE candidate to other users in the room
    await sio.emit('ice-candidate', {'candidate': candidate}, room=room_id, skip_sid=sid)

@sio.event
async def chat_message(sid, data):
    """Handle chat messages"""
    if sid not in user_sessions:
        await sio.emit('error', {'message': 'Not in a room'}, room=sid)
        return
    
    room_id = user_sessions[sid]
    message_text = data if isinstance(data, str) else data.get('message', '')
    
    message_data = {
        'text': message_text,
        'timestamp': datetime.utcnow().isoformat(),
        'sender': sid
    }
    
    # Broadcast message to room (excluding sender)
    await sio.emit('chat-message', message_data, room=room_id, skip_sid=sid)

@sio.event
async def partner_matched(sid, data):
    """Notify users when they've been matched"""
    room_id = data.get('room_id')
    partner_info = data.get('partner_info')
    
    if room_id and room_id in active_rooms:
        await sio.emit('partner-matched', {
            'partner_info': partner_info,
            'room_id': room_id
        }, room=room_id)

@sio.event
async def session_ended(sid, data):
    """Handle session ending"""
    if sid not in user_sessions:
        return
    
    room_id = user_sessions[sid]
    
    # Notify all users in the room
    await sio.emit('session-ended', {
        'message': 'Language partner session has ended',
        'timestamp': datetime.utcnow().isoformat()
    }, room=room_id)
    
    # Clean up room
    if room_id in active_rooms:
        for user_sid in list(active_rooms[room_id]):
            await sio.leave_room(user_sid, room_id)
            if user_sid in user_sessions:
                del user_sessions[user_sid]
        del active_rooms[room_id]

# Helper function to get room info
async def get_room_info(room_id: str) -> Dict:
    """Get information about a specific room"""
    if room_id not in active_rooms:
        return {'exists': False}
    
    return {
        'exists': True,
        'user_count': len(active_rooms[room_id]),
        'users': list(active_rooms[room_id])
    }

# Function to notify users of new matches (called from API)
async def notify_match_found(room_id: str, user1_info: Dict, user2_info: Dict):
    """Notify users when a match is found"""
    if room_id in active_rooms:
        await sio.emit('match-found', {
            'user1': user1_info,
            'user2': user2_info,
            'room_id': room_id
        }, room=room_id)