from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum

class ModeEnum(str, Enum):
    TEACH = "teach"
    LEARN = "learn"

class SessionStatusEnum(str, Enum):
    SEARCHING = "searching"
    MATCHED = "matched"
    IN_CALL = "in_call"
    COMPLETED = "completed" 
    CANCELLED = "cancelled"

class LanguagePartnerPreferenceCreate(BaseModel):
    mode: ModeEnum
    target_language: str
    instruction_language: str

class LanguagePartnerPreferenceUpdate(BaseModel):
    mode: Optional[ModeEnum] = None
    target_language: Optional[str] = None
    instruction_language: Optional[str] = None

class LanguagePartnerPreferenceResponse(BaseModel):
    id: int
    user_id: int
    mode: ModeEnum
    target_language: str
    instruction_language: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MatchRequest(BaseModel):
    preferences: LanguagePartnerPreferenceCreate

class MatchResponse(BaseModel):
    session_id: int
    room_id: str
    partner_info: Optional[dict] = None
    status: SessionStatusEnum

class PartnerInfo(BaseModel):
    id: int
    first_name: str
    last_name: str
    mode: ModeEnum
    target_language: str
    instruction_language: str

class SessionResponse(BaseModel):
    id: int
    room_id: str
    status: SessionStatusEnum
    partner_info: Optional[PartnerInfo] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None

    class Config:
        from_attributes = True

class EndSessionRequest(BaseModel):
    session_id: int
    duration_minutes: Optional[int] = None

class FeedbackCreate(BaseModel):
    session_id: int
    rating: int  # 1-5
    comment: Optional[str] = None

class FeedbackResponse(BaseModel):
    id: int
    session_id: int
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class UserPreferencesResponse(BaseModel):
    preferences: List[LanguagePartnerPreferenceResponse]
    recent_sessions: List[SessionResponse]

    class Config:
        from_attributes = True