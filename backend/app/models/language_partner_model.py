from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from ..core.database import Base

class ModeEnum(str, enum.Enum):
    TEACH = "teach"
    LEARN = "learn"

class SessionStatusEnum(str, enum.Enum):
    SEARCHING = "searching"
    MATCHED = "matched"
    IN_CALL = "in_call"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class LanguagePartnerPreference(Base):
    __tablename__ = "language_partner_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    mode = Column(Enum(ModeEnum), nullable=False)  # "teach" or "learn"
    target_language = Column(String(50), nullable=False)
    instruction_language = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="language_preferences")

class LanguagePartnerSession(Base):
    __tablename__ = "language_partner_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user1_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    user2_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)  # Null when searching
    user1_preference_id = Column(Integer, ForeignKey("language_partner_preferences.id"), nullable=False)
    user2_preference_id = Column(Integer, ForeignKey("language_partner_preferences.id"), nullable=True)
    room_id = Column(String(100), unique=True, nullable=False)
    status = Column(Enum(SessionStatusEnum), default=SessionStatusEnum.SEARCHING)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=True)

    # Relationships
    user1 = relationship("User", foreign_keys=[user1_id])
    user2 = relationship("User", foreign_keys=[user2_id])
    user1_preference = relationship("LanguagePartnerPreference", foreign_keys=[user1_preference_id])
    user2_preference = relationship("LanguagePartnerPreference", foreign_keys=[user2_preference_id])

class LanguagePartnerFeedback(Base):
    __tablename__ = "language_partner_feedback"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("language_partner_sessions.id"), nullable=False)
    from_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    to_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5 stars
    comment = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("LanguagePartnerSession")
    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])
