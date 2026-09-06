import asyncio
import uuid
from datetime import datetime
from typing import Dict, Optional, Set
from dataclasses import dataclass

@dataclass
class PartnerRequest:
    user_id: str
    mode: str  # 'teach' or 'learn'
    target_language: str
    instruction_language: str
    socket_id: str
    timestamp: datetime

class LanguagePartnerMatcher:
    def __init__(self):
        # Store pending requests waiting for matches
        self.pending_requests: Dict[str, PartnerRequest] = {}
        # Store active rooms
        self.active_rooms: Dict[str, Set[str]] = {}
        # Map socket IDs to room IDs
        self.socket_to_room: Dict[str, str] = {}
    
    def add_request(self, request: PartnerRequest) -> Optional[str]:
        """Add a partner request and try to find a match"""
        print(f"DEBUG: Adding request for user {request.user_id}, mode: {request.mode}, target: {request.target_language}, instruction: {request.instruction_language}")
        print(f"DEBUG: Current pending requests: {[(r.user_id, r.mode, r.target_language, r.instruction_language) for r in self.pending_requests.values()]}")
        
        # First, try to find a compatible match
        match = self._find_match(request)
        
        print(f"DEBUG: Found match: {match.user_id if match else None}")
        
        if match:
            # Create a room for the matched pair
            room_id = f"room_{uuid.uuid4().hex[:12]}"
            
            print(f"DEBUG: Creating room {room_id} with {request.socket_id} and {match.socket_id}")
            
            # Remove the matched request from pending
            del self.pending_requests[match.user_id]
            
            # Create room with both users
            self.active_rooms[room_id] = {request.socket_id, match.socket_id}
            self.socket_to_room[request.socket_id] = room_id
            self.socket_to_room[match.socket_id] = room_id
            
            return room_id
        else:
            # No match found, add to pending requests
            self.pending_requests[request.user_id] = request
            print(f"DEBUG: No match found, added to pending. Total pending: {len(self.pending_requests)}")
            return None
    
    def _find_match(self, request: PartnerRequest) -> Optional[PartnerRequest]:
        """Find a compatible partner from pending requests"""
        opposite_mode = 'learn' if request.mode == 'teach' else 'teach'
        
        print(f"DEBUG: Looking for {opposite_mode} partners for {request.mode} request")
        
        for pending_request in self.pending_requests.values():
            print(f"DEBUG: Checking pending request: mode={pending_request.mode}, target={pending_request.target_language}, instruction={pending_request.instruction_language}")
            
            # Check if it's a compatible match
            if (pending_request.mode == opposite_mode and
                self._languages_compatible(request, pending_request)):
                print(f"DEBUG: Found compatible match!")
                return pending_request
        
        return None
    
    def _languages_compatible(self, req1: PartnerRequest, req2: PartnerRequest) -> bool:
        """Check if two requests have compatible languages"""
        print(f"DEBUG: Checking compatibility between req1(mode={req1.mode}, target={req1.target_language}, instruction={req1.instruction_language}) and req2(mode={req2.mode}, target={req2.target_language}, instruction={req2.instruction_language})")
        
        # They must be able to communicate (same instruction language)
        if req1.instruction_language != req2.instruction_language:
            print(f"DEBUG: Different instruction languages: {req1.instruction_language} vs {req2.instruction_language}")
            return False
        
        # For language exchange, we need:
        # - One person teaching X, other learning X (same target language)
        # OR 
        # - Any compatible pair that can communicate in the instruction language
        if req1.target_language == req2.target_language:
            print(f"DEBUG: Same target language match: {req1.target_language}")
            return True
        
        # Also accept any pair with same instruction language (more flexible matching)
        print(f"DEBUG: Same instruction language match: {req1.instruction_language}")
        return True
    
    def remove_request(self, user_id: str):
        """Remove a pending request"""
        if user_id in self.pending_requests:
            del self.pending_requests[user_id]
    
    def remove_socket(self, socket_id: str):
        """Remove a socket from rooms and pending requests"""
        # Remove from room
        if socket_id in self.socket_to_room:
            room_id = self.socket_to_room[socket_id]
            if room_id in self.active_rooms:
                self.active_rooms[room_id].discard(socket_id)
                # Don't immediately delete empty rooms - keep them for a short time
                # in case users are transitioning between pages
                print(f"DEBUG: Socket {socket_id} removed from room {room_id}. Room now has {len(self.active_rooms[room_id])} users")
            del self.socket_to_room[socket_id]
        
        # Remove from pending requests
        for user_id, request in list(self.pending_requests.items()):
            if request.socket_id == socket_id:
                del self.pending_requests[user_id]
                break
    
    def get_room_by_socket(self, socket_id: str) -> Optional[str]:
        """Get room ID for a given socket"""
        return self.socket_to_room.get(socket_id)
    
    def get_room_sockets(self, room_id: str) -> Set[str]:
        """Get all socket IDs in a room"""
        return self.active_rooms.get(room_id, set())
    
    def cleanup_empty_rooms(self):
        """Remove empty rooms (called periodically)"""
        rooms_to_delete = []
        for room_id, sockets in self.active_rooms.items():
            if len(sockets) == 0:
                rooms_to_delete.append(room_id)
        
        for room_id in rooms_to_delete:
            print(f"DEBUG: Cleaning up empty room {room_id}")
            del self.active_rooms[room_id]

# Global matcher instance
matcher = LanguagePartnerMatcher()