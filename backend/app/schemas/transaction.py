from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class TransactionStatus(str, Enum):
    PENDING = 'Pending'
    ACCEPTED = 'Accepted'
    REJECTED = 'Rejected'
    COMPLETED = 'Completed'

class TransactionCreate(BaseModel):
    listing_id: int
    message: Optional[str] = None

class TransactionResponse(BaseModel):
    transaction_id: int
    listing_id: int
    buyer_id: int
    seller_id: int
    status: TransactionStatus
    offered_at: datetime
    responded_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    message: Optional[str] = None
    
    model_config = {"from_attributes": True}

class TransactionUpdate(BaseModel):
    status: TransactionStatus
    model_config = {"from_attributes": True}

class ReviewCreate(BaseModel):
    transaction_id: int
    rating: float = Field(..., ge=1, le=5)
    comment: Optional[str] = None

class ReviewResponse(BaseModel):
    review_id: int
    transaction_id: int
    reviewer_id: int
    reviewee_id: int
    rating: float
    comment: Optional[str] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}