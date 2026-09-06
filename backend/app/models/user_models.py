from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, DECIMAL, Boolean, LargeBinary
from datetime import datetime
from ..core.database import Base
from sqlalchemy.orm import relationship
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from watchlist_model import Watchlist
    
from . import watchlist_model
class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    phone_number = Column(String(20), nullable=True)
    profile_picture = Column(String(255), nullable=True)
    bio = Column(String(500), nullable=True)
    registration_date = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)
    account_status = Column(Enum('Active', 'Suspended', 'Deactivated'), default='Active')
    verification_status = Column(Boolean, default=False)
    trust_score = Column(DECIMAL(3,2), default=0.00)
    two_fa = Column(Boolean, default=False)
    two_fa_secret_blob  = Column(LargeBinary(length=128), nullable=True)
    two_fa_secret_nonce = Column(LargeBinary(length=16),  nullable=True)
    listings_count = Column(Integer, default=0)


    listings = relationship("Listing", back_populates="creator")
    permission_id = Column(Integer, ForeignKey("permissions.permission_id"))
    permission = relationship("Permission")
    watchlists = relationship("Watchlist", back_populates="user", cascade="all, delete-orphan")
    language_preferences = relationship("LanguagePartnerPreference", back_populates="user", cascade="all, delete-orphan")
