from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    Admin = "Admin"
    Moderator = "Moderator"
    User = "User"

class UserStatus(str, Enum):
    Active = "Active"
    Suspended = "Suspended"
    Deactivated = "Deactivated"

class UserListItem(BaseModel):
    user_id: int
    email: str
    first_name: str
    last_name: str
    registration_date: datetime
    account_status: str
    verification_status: Optional[bool] = False
    trust_score: Optional[float] = 0.0
    permission_id: int
    role_name: str

    class Config:
        orm_mode = True

class UsersList(BaseModel):
    users: List[UserListItem]
    total: int
    page: int
    size: int

class UpdateUserPermission(BaseModel):
    role: UserRole

class UpdateUserStatus(BaseModel):
    status: UserStatus

class ListingStatus(str, Enum):
    Review = "Review"
    Active = "Active"
    Reserved = "Reserved"
    Rejected = "Rejected"
    Sold = "Sold"
    Expired = "Expired"

class ListingAdminView(BaseModel):
    listing_id: int
    title: str
    price: float
    created_by: int
    user_email: str
    user_name: str
    created_at: datetime
    status: str
    is_featured: bool
    
    class Config:
        orm_mode = True

class ListingsAdminList(BaseModel):
    listings: List[ListingAdminView]
    total: int
    page: int
    size: int

class UpdateListingStatus(BaseModel):
    status: ListingStatus
    

class FeatureListingRequest(BaseModel):
    is_featured: bool