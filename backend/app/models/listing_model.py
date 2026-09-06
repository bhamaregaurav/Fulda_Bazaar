from sqlalchemy import Column, Integer, String, Text, Enum, Numeric, Boolean, DateTime, ForeignKey, Date, func,text
from geoalchemy2 import Geometry
from sqlalchemy.orm import relationship
from ..core.database import Base
from typing import TYPE_CHECKING
from . import watchlist_model
if TYPE_CHECKING:
    from .watchlist_model import Watchlist
    from .user_models import User

class Category(Base):
    __tablename__ = "categories"
    category_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True)
    is_active = Column(Boolean, default=True)

    
class Listing(Base):
    __tablename__ = "listings"
    listing_id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.category_id"), nullable=False)
    subcategory_id = Column(Integer, ForeignKey("categories.category_id"), nullable=True)
    listing_type = Column(Enum('Sell', 'Buy', 'Exchange', 'Borrow/Lend', 'Free'), nullable=False)
    price = Column(Numeric(10, 2), nullable=True)
    negotiable = Column(Boolean, default=False)
    condition = Column(Enum('New', 'Like New', 'Good', 'Fair', 'Poor'), nullable=False)
    location = Column(String(255), nullable=True)
    geo_coordinates = Column(Geometry("POINT", srid=4326), nullable=True)
    status = Column(Enum('Review', 'Active','Rejected', 'Reserved', 'Sold', 'Expired'), default='Review')
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    created_at = Column(DateTime, server_default=func.current_timestamp())
    updated_at = Column(DateTime, onupdate=func.current_timestamp())
    expiration_date = Column(Date,server_default=text("DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)")
                     )
    view_count = Column(Integer, default=0)
    is_featured = Column(Boolean, default=False)
    exchange_preferences = Column(Text, nullable=True)
    borrow_duration = Column(String(100), nullable=True)

    category = relationship("Category", foreign_keys=[category_id])
    subcategory = relationship("Category", foreign_keys=[subcategory_id])
    images = relationship("ListingImage", back_populates="listing", cascade="all, delete-orphan", passive_deletes=True)
    creator = relationship("User", back_populates="listings", foreign_keys=[created_by])
    watchers = relationship("Watchlist", back_populates="listing", cascade="all, delete-orphan")

    
class ListingImage(Base):
    __tablename__ = "listing_images"
    image_id = Column(Integer, primary_key=True, autoincrement=True)
    listing_id = Column(Integer, ForeignKey("listings.listing_id", ondelete="CASCADE"), nullable=False)
    image_path = Column(String(255), nullable=False)
    is_primary = Column(Boolean, default=False)
    upload_date = Column(DateTime, server_default=func.current_timestamp())
    display_order = Column(Integer, default=0)

    listing = relationship("Listing", back_populates="images")
