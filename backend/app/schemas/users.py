from datetime import datetime
from decimal   import Decimal
from typing    import Optional
from pydantic  import BaseModel, EmailStr, HttpUrl, Field
from typing       import Optional

class PublicUserOut(BaseModel):
    user_id: int
    first_name: str
    last_name: str
    profile_picture: Optional[HttpUrl]
    bio: Optional[str]
    registration_date: datetime
    account_status: str
    verification_status: bool
    trust_score: Decimal
    listings_count: int
    # Rating statistics
    average_rating: Optional[float] = None
    total_reviews: int = 0
    positive_reviews: int = 0
    neutral_reviews: int = 0
    negative_reviews: int = 0
    
    class Config:
        orm_mode = True

class UserOut(BaseModel):
    user_id: int
    email: EmailStr
    first_name: str
    last_name: str
    phone_number: Optional[str]
    profile_picture: Optional[HttpUrl]
    bio: Optional[str]
    registration_date: datetime
    last_login: Optional[datetime]
    account_status: str
    verification_status: bool
    trust_score: Decimal
    two_fa: bool
    listings_count: int
    permission_id: int  # Add this field
    role_name: Optional[str] = None  # Add this field
    class Config:
        orm_mode = True
class UserUpdate(BaseModel):
    first_name:     Optional[str]
    last_name:      Optional[str]
    phone_number:   Optional[str]   = Field(None, max_length=20)
    profile_picture: Optional[HttpUrl]
    bio:            Optional[str]   = Field(None, max_length=500)
class ListingUpdate(BaseModel):
    title:          Optional[str]
    description:    Optional[str]
    category_id:    Optional[int]
    listing_type:   Optional[str]
    price:          Optional[Decimal]
    negotiable:     Optional[bool]
    condition:      Optional[str]
    location:       Optional[str]
    latitude:       Optional[float]
    longitude:      Optional[float]
    class Config:
        from_attributes = True
class ListingOut(BaseModel):
    listing_id: int
    title:      str
    description: str | None = None
    category_id: int | None = None
    #subcategory_id: int | None = None
    listing_type: str
    price: Decimal | None = None
    negotiable: bool | None = None
    condition: str | None = None
    location: str | None = None
    created_at:  datetime
    updated_at:  datetime
    class Config:
        from_attributes = True