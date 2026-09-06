from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint, func
from sqlalchemy.orm import relationship
from ..core.database import Base
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .user_models import User
    from .listing_model import Listing

class Watchlist(Base):
    __tablename__ = "watchlists"

    watchlist_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    listing_id = Column(Integer, ForeignKey("listings.listing_id", ondelete="CASCADE"), nullable=False)
    added_at = Column(DateTime, server_default=func.now(), nullable=False)

    # Relationships (optional, for ORM navigation)
    user = relationship("User", back_populates="watchlists")
    listing = relationship("Listing", back_populates="watchers")

    __table_args__ = (
        UniqueConstraint('user_id', 'listing_id', name='unique_user_listing'),
    )