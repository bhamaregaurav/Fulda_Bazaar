from datetime import datetime, date
from decimal   import Decimal
from typing    import List, Optional
from pydantic  import BaseModel, HttpUrl

# ─── image sub-schema ─────────────────────────────────────────────────────
class ListingImageOut(BaseModel):
    image_id    : int
    image_path  : HttpUrl
    is_primary  : bool
    upload_date : datetime

    model_config = {"from_attributes": True}   # ← replaces orm_mode

# ─── main listing schema ──────────────────────────────────────────────────
class ListingOut(BaseModel):
    listing_id     : int
    title          : str
    description    : str
    category_id    : int
    subcategory_id : Optional[int]
    listing_type   : str
    price          : Optional[Decimal]
    negotiable     : bool
    condition      : str
    location       : Optional[str]
    created_by     : int
    created_at     : Optional[datetime]
    updated_at     : Optional[datetime]
    expiration_date: Optional[date]
    view_count     : int
    is_featured    : bool
    images         : List[ListingImageOut] = []

    model_config = {"from_attributes": True}   # ← Pydantic v2
