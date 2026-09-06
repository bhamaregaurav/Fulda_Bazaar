from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


class ListingType(str, Enum):
    sell = "Sell"
    buy = "Buy"
    exchange = "Exchange"
    borrow_lend = "Borrow/Lend"
    free = "Free"

class Condition(str, Enum):
    new = "New"
    like_new = "Like New"
    good = "Good"
    fair = "Fair"
    poor = "Poor"

class Status(str, Enum):
    review = "Review"
    active = "Active"
    reserved = "Reserved"
    sold = "Sold"
    expired = "Expired"


class ListingImageResponse(BaseModel):
    image_id: int
    image_path: str
    is_primary: bool
    display_order: int

    class Config:
        orm_mode = True


class ListingResponse(BaseModel):
    listing_id: int
    title: str
    description: str
    category_id: int
    subcategory_id: Optional[int]
    listing_type: ListingType
    price: Optional[float]
    negotiable: bool
    condition: Condition
    location: Optional[str]
    geo_coordinates: str  # You might need to serialize Geometry to WKT or lat/long
    status: Status
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime]
    expiration_date: Optional[date]
    view_count: int
    is_featured: bool
    exchange_preferences: Optional[str]
    borrow_duration: Optional[str]
    images: List[ListingImageResponse] = []

    class Config:
        orm_mode = True
