from pydantic import BaseModel, constr, Field
from datetime import datetime
from typing import Optional

class MessageIn(BaseModel):
    text: constr(min_length=1, max_length=200)

class ListingInfo(BaseModel):
    listing_id: int
    title: str
    first_image: Optional[str] = None

class MessageOut(BaseModel):
    message_id: int
    sender_id: int
    receiver_id: int
    text: str = Field(..., description="Decrypted/plaintext")
    sent_at: datetime

    model_config = {"from_attributes": True}
    listing_info: Optional[ListingInfo] = None
    
    model_config = {"from_attributes": True}