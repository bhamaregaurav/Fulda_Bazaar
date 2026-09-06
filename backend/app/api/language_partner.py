from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from ..core.database import get_db
from ..core.security import get_current_user
from ..models.user_models import User
from ..repositories.language_partner import LanguagePartnerRepository
from ..schemas.language_partner import (
    LanguagePartnerPreferenceCreate,
    LanguagePartnerPreferenceResponse,
    MatchRequest,
    MatchResponse,
    SessionResponse,
    EndSessionRequest,
    FeedbackCreate,
    FeedbackResponse,
    UserPreferencesResponse,
    PartnerInfo,
    SessionStatusEnum
)

router = APIRouter(prefix="/api/language-partner", tags=["Language Partner"])

@router.post("/preferences", response_model=LanguagePartnerPreferenceResponse)
async def create_or_update_preferences(
    preference_data: LanguagePartnerPreferenceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create or update user's language partner preferences"""
    preference = await LanguagePartnerRepository.create_preference(
        db, current_user.user_id, preference_data
    )
    return preference

@router.get("/preferences", response_model=Optional[LanguagePartnerPreferenceResponse])
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's current language partner preferences"""
    preference = await LanguagePartnerRepository.get_active_preference(db, current_user.user_id)
    return preference

@router.post("/match", response_model=MatchResponse)
async def find_partner(
    match_request: MatchRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Find a language partner match"""
    
    # Check if user already has an active session
    existing_session = await LanguagePartnerRepository.get_active_session(db, current_user.user_id)
    if existing_session:
        if existing_session.status == SessionStatusEnum.SEARCHING:
            return MatchResponse(
                session_id=existing_session.id,
                room_id=existing_session.room_id,
                status=existing_session.status
            )
        elif existing_session.status in [SessionStatusEnum.MATCHED, SessionStatusEnum.IN_CALL]:
            # Get partner info
            partner = existing_session.user2 if existing_session.user1_id == current_user.user_id else existing_session.user1
            partner_pref = existing_session.user2_preference if existing_session.user1_id == current_user.user_id else existing_session.user1_preference
            
            partner_info = None
            if partner and partner_pref:
                partner_info = {
                    "id": partner.user_id,
                    "first_name": partner.first_name,
                    "last_name": partner.last_name,
                    "mode": partner_pref.mode,
                    "target_language": partner_pref.target_language,
                    "instruction_language": partner_pref.instruction_language
                }
            
            return MatchResponse(
                session_id=existing_session.id,
                room_id=existing_session.room_id,
                partner_info=partner_info,
                status=existing_session.status
            )
    
    # Create or update preferences
    preference = await LanguagePartnerRepository.create_preference(
        db, current_user.user_id, match_request.preferences
    )
    
    # Try to find a match
    match = await LanguagePartnerRepository.find_match(db, current_user.user_id, preference)
    
    if match:
        # Create matched session
        session = await LanguagePartnerRepository.create_session(
            db, 
            current_user.user_id, 
            preference.id,
            match.user_id,
            match.id
        )
        
        partner_info = {
            "id": match.user.user_id,
            "first_name": match.user.first_name,
            "last_name": match.user.last_name,
            "mode": match.mode,
            "target_language": match.target_language,
            "instruction_language": match.instruction_language
        }
        
        return MatchResponse(
            session_id=session.id,
            room_id=session.room_id,
            partner_info=partner_info,
            status=session.status
        )
    else:
        # Create searching session
        session = await LanguagePartnerRepository.create_session(
            db, current_user.user_id, preference.id
        )
        
        # Add background task to periodically check for matches
        background_tasks.add_task(check_for_matches, session.id, db)
        
        return MatchResponse(
            session_id=session.id,
            room_id=session.room_id,
            status=session.status
        )

@router.get("/session/current", response_model=Optional[SessionResponse])
async def get_current_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's current active session"""
    session = await LanguagePartnerRepository.get_active_session(db, current_user.user_id)
    if not session:
        return None
    
    partner = session.user2 if session.user1_id == current_user.user_id else session.user1
    partner_pref = session.user2_preference if session.user1_id == current_user.user_id else session.user1_preference
    
    partner_info = None
    if partner and partner_pref:
        partner_info = PartnerInfo(
            id=partner.user_id,
            first_name=partner.first_name,
            last_name=partner.last_name,
            mode=partner_pref.mode,
            target_language=partner_pref.target_language,
            instruction_language=partner_pref.instruction_language
        )
    
    return SessionResponse(
        id=session.id,
        room_id=session.room_id,
        status=session.status,
        partner_info=partner_info,
        started_at=session.started_at,
        ended_at=session.ended_at,
        duration_minutes=session.duration_minutes
    )

@router.patch("/session/{session_id}/status")
async def update_session_status(
    session_id: int,
    status: SessionStatusEnum,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update session status (e.g., from matched to in_call)"""
    session = await LanguagePartnerRepository.get_active_session(db, current_user.user_id)
    
    if not session or session.id != session_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    if session.user1_id != current_user.user_id and session.user2_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this session"
        )
    
    updated_session = await LanguagePartnerRepository.update_session_status(
        db, session_id, status
    )
    
    return {"message": "Session status updated", "status": status}

@router.post("/session/end")
async def end_session(
    end_request: EndSessionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """End a language partner session"""
    session = await LanguagePartnerRepository.get_active_session(db, current_user.user_id)
    
    if not session or session.id != end_request.session_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    if session.user1_id != current_user.user_id and session.user2_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to end this session"
        )
    
    ended_session = await LanguagePartnerRepository.end_session(
        db, end_request.session_id, end_request.duration_minutes
    )
    
    return {"message": "Session ended successfully"}

@router.post("/feedback", response_model=FeedbackResponse)
async def create_feedback(
    feedback_data: FeedbackCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create feedback for a completed session"""
    session = await LanguagePartnerRepository.get_active_session(db, current_user.user_id)
    
    # Allow feedback for completed sessions
    if not session or session.id != feedback_data.session_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    if session.user1_id != current_user.user_id and session.user2_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to provide feedback for this session"
        )
    
    # Determine who to give feedback to
    to_user_id = session.user2_id if session.user1_id == current_user.user_id else session.user1_id
    
    if not to_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot provide feedback for session without partner"
        )
    
    feedback = await LanguagePartnerRepository.create_feedback(
        db, 
        feedback_data.session_id,
        current_user.user_id,
        to_user_id,
        feedback_data.rating,
        feedback_data.comment
    )
    
    return feedback

@router.get("/history", response_model=UserPreferencesResponse)
async def get_user_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's language partner history and preferences"""
    # Get current preferences
    current_preference = await LanguagePartnerRepository.get_active_preference(db, current_user.user_id)
    preferences = [current_preference] if current_preference else []
    
    # Get recent sessions
    sessions = await LanguagePartnerRepository.get_user_sessions(db, current_user.user_id, 10)
    
    session_responses = []
    for session in sessions:
        partner = session.user2 if session.user1_id == current_user.user_id else session.user1
        partner_pref = session.user2_preference if session.user1_id == current_user.user_id else session.user1_preference
        
        partner_info = None
        if partner and partner_pref:
            partner_info = PartnerInfo(
                id=partner.user_id,
                first_name=partner.first_name,
                last_name=partner.last_name,
                mode=partner_pref.mode,
                target_language=partner_pref.target_language,
                instruction_language=partner_pref.instruction_language
            )
        
        session_responses.append(SessionResponse(
            id=session.id,
            room_id=session.room_id,
            status=session.status,
            partner_info=partner_info,
            started_at=session.started_at,
            ended_at=session.ended_at,
            duration_minutes=session.duration_minutes
        ))
    
    return UserPreferencesResponse(
        preferences=preferences,
        recent_sessions=session_responses
    )

async def check_for_matches(session_id: int, db: AsyncSession):
    """Background task to check for matches periodically"""
    # This would be implemented with a more sophisticated matching algorithm
    # For now, it's a placeholder for the background matching process
    pass