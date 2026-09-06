from pydantic import BaseModel
from datetime import datetime

class WatchlistCreate(BaseModel):
    listing_id: int

class WatchlistResponse(WatchlistCreate):
    watchlist_id: int
    added_at: datetime

    class Config:
        orm_mode = True
