from fastapi import APIRouter
from app.services.language_partner_matcher import matcher

router = APIRouter()

@router.get("/debug/matcher/status")
async def get_matcher_status():
    """Debug endpoint to see current matcher state"""
    return {
        "pending_requests": [
            {
                "user_id": req.user_id,
                "mode": req.mode,
                "target_language": req.target_language,
                "instruction_language": req.instruction_language,
                "socket_id": req.socket_id
            }
            for req in matcher.pending_requests.values()
        ],
        "active_rooms": {
            room_id: list(sockets) 
            for room_id, sockets in matcher.active_rooms.items()
        },
        "socket_to_room": dict(matcher.socket_to_room),
        "total_pending": len(matcher.pending_requests),
        "total_rooms": len(matcher.active_rooms)
    }

@router.post("/debug/matcher/clear")
async def clear_matcher_state():
    """Clear all matcher state for testing"""
    matcher.pending_requests.clear()
    matcher.active_rooms.clear()
    matcher.socket_to_room.clear()
    return {"message": "Matcher state cleared"}
