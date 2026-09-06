from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, update
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

from ..models.language_partner_model import (
    LanguagePartnerPreference, 
    LanguagePartnerSession, 
    LanguagePartnerFeedback,
    ModeEnum,
    SessionStatusEnum
)
from ..schemas.language_partner import LanguagePartnerPreferenceCreate, LanguagePartnerPreferenceUpdate

class LanguagePartnerRepository:
    
    @staticmethod
    async def create_preference(
        db: AsyncSession, 
        user_id: int, 
        preference_data: LanguagePartnerPreferenceCreate
    ) -> LanguagePartnerPreference:
        # Deactivate existing preferences for this user
        await db.execute(
            update(LanguagePartnerPreference)
            .where(LanguagePartnerPreference.user_id == user_id)
            .values(is_active=False)
        )
        
        preference = LanguagePartnerPreference(
            user_id=user_id,
            mode=preference_data.mode,
            target_language=preference_data.target_language,
            instruction_language=preference_data.instruction_language,
            is_active=True
        )
        db.add(preference)
        await db.commit()
        await db.refresh(preference)
        return preference
    
    @staticmethod
    async def get_active_preference(db: AsyncSession, user_id: int) -> Optional[LanguagePartnerPreference]:
        result = await db.execute(
            select(LanguagePartnerPreference)
            .where(
                and_(
                    LanguagePartnerPreference.user_id == user_id,
                    LanguagePartnerPreference.is_active == True
                )
            )
            .options(selectinload(LanguagePartnerPreference.user))
        )
        return result.scalars().first()
    
    @staticmethod
    async def find_match(
        db: AsyncSession, 
        user_id: int, 
        preference: LanguagePartnerPreference
    ) -> Optional[LanguagePartnerPreference]:
        # Find someone with complementary preferences
        opposite_mode = ModeEnum.LEARN if preference.mode == ModeEnum.TEACH else ModeEnum.TEACH
        
        result = await db.execute(
            select(LanguagePartnerPreference)
            .where(
                and_(
                    LanguagePartnerPreference.user_id != user_id,
                    LanguagePartnerPreference.is_active == True,
                    LanguagePartnerPreference.mode == opposite_mode,
                    or_(
                        # Perfect match: they want to learn what we teach and vice versa
                        and_(
                            LanguagePartnerPreference.target_language == preference.target_language,
                            LanguagePartnerPreference.instruction_language == preference.instruction_language
                        ),
                        # Good match: at least common instruction language
                        LanguagePartnerPreference.instruction_language == preference.instruction_language
                    )
                )
            )
            .options(selectinload(LanguagePartnerPreference.user))
            .limit(1)
        )
        return result.scalars().first()
    
    @staticmethod
    async def create_session(
        db: AsyncSession,
        user1_id: int,
        user1_preference_id: int,
        user2_id: Optional[int] = None,
        user2_preference_id: Optional[int] = None
    ) -> LanguagePartnerSession:
        room_id = f"room_{uuid.uuid4().hex}"
        status = SessionStatusEnum.MATCHED if user2_id else SessionStatusEnum.SEARCHING
        
        session = LanguagePartnerSession(
            user1_id=user1_id,
            user2_id=user2_id,
            user1_preference_id=user1_preference_id,
            user2_preference_id=user2_preference_id,
            room_id=room_id,
            status=status
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session
    
    @staticmethod
    async def get_active_session(db: AsyncSession, user_id: int) -> Optional[LanguagePartnerSession]:
        result = await db.execute(
            select(LanguagePartnerSession)
            .where(
                and_(
                    or_(
                        LanguagePartnerSession.user1_id == user_id,
                        LanguagePartnerSession.user2_id == user_id
                    ),
                    LanguagePartnerSession.status.in_([
                        SessionStatusEnum.SEARCHING,
                        SessionStatusEnum.MATCHED,
                        SessionStatusEnum.IN_CALL
                    ])
                )
            )
            .options(
                selectinload(LanguagePartnerSession.user1),
                selectinload(LanguagePartnerSession.user2),
                selectinload(LanguagePartnerSession.user1_preference),
                selectinload(LanguagePartnerSession.user2_preference)
            )
            .order_by(LanguagePartnerSession.started_at.desc())
        )
        return result.scalars().first()
    
    @staticmethod
    async def update_session_status(
        db: AsyncSession, 
        session_id: int, 
        status: SessionStatusEnum,
        user2_id: Optional[int] = None,
        user2_preference_id: Optional[int] = None
    ) -> Optional[LanguagePartnerSession]:
        update_data = {"status": status}
        if user2_id:
            update_data["user2_id"] = user2_id
        if user2_preference_id:
            update_data["user2_preference_id"] = user2_preference_id
            
        await db.execute(
            update(LanguagePartnerSession)
            .where(LanguagePartnerSession.id == session_id)
            .values(**update_data)
        )
        await db.commit()
        
        result = await db.execute(
            select(LanguagePartnerSession)
            .where(LanguagePartnerSession.id == session_id)
            .options(
                selectinload(LanguagePartnerSession.user1),
                selectinload(LanguagePartnerSession.user2),
                selectinload(LanguagePartnerSession.user1_preference),
                selectinload(LanguagePartnerSession.user2_preference)
            )
        )
        return result.scalars().first()
    
    @staticmethod
    async def end_session(
        db: AsyncSession, 
        session_id: int, 
        duration_minutes: Optional[int] = None
    ) -> Optional[LanguagePartnerSession]:
        await db.execute(
            update(LanguagePartnerSession)
            .where(LanguagePartnerSession.id == session_id)
            .values(
                status=SessionStatusEnum.COMPLETED,
                ended_at=datetime.utcnow(),
                duration_minutes=duration_minutes
            )
        )
        await db.commit()
        
        result = await db.execute(
            select(LanguagePartnerSession)
            .where(LanguagePartnerSession.id == session_id)
        )
        return result.scalars().first()
    
    @staticmethod
    async def get_user_sessions(
        db: AsyncSession, 
        user_id: int, 
        limit: int = 10
    ) -> List[LanguagePartnerSession]:
        result = await db.execute(
            select(LanguagePartnerSession)
            .where(
                or_(
                    LanguagePartnerSession.user1_id == user_id,
                    LanguagePartnerSession.user2_id == user_id
                )
            )
            .options(
                selectinload(LanguagePartnerSession.user1),
                selectinload(LanguagePartnerSession.user2),
                selectinload(LanguagePartnerSession.user1_preference),
                selectinload(LanguagePartnerSession.user2_preference)
            )
            .order_by(LanguagePartnerSession.started_at.desc())
            .limit(limit)
        )
        return result.scalars().all()
    
    @staticmethod
    async def create_feedback(
        db: AsyncSession,
        session_id: int,
        from_user_id: int,
        to_user_id: int,
        rating: int,
        comment: Optional[str] = None
    ) -> LanguagePartnerFeedback:
        feedback = LanguagePartnerFeedback(
            session_id=session_id,
            from_user_id=from_user_id,
            to_user_id=to_user_id,
            rating=rating,
            comment=comment
        )
        db.add(feedback)
        await db.commit()
        await db.refresh(feedback)
        return feedback