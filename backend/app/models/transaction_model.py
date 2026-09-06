from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum, func
from sqlalchemy.orm import relationship
from ..core.database import Base

class Transaction(Base):
    __tablename__ = "transactions"
    
    transaction_id = Column(Integer, primary_key=True, autoincrement=True)
    listing_id = Column(Integer, ForeignKey("listings.listing_id", ondelete="CASCADE"), nullable=False)
    buyer_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum('Pending', 'Accepted', 'Rejected', 'Completed'), default='Pending', nullable=False)
    offered_at = Column(DateTime, server_default=func.now(), nullable=False)
    responded_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    message = Column(Text, nullable=True)  # Optional message from buyer to seller
    
    # Relationships
    listing = relationship("Listing", backref="transactions")
    buyer = relationship("User", foreign_keys=[buyer_id], backref="purchases")
    seller = relationship("User", foreign_keys=[seller_id], backref="sales")