from fastapi import APIRouter, Depends, HTTPException, status, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, desc
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.watchlist_model import Watchlist
from app.models.listing_model import Listing
from app.models.user_models import User
from app.schemas.watchlist import WatchlistCreate, WatchlistResponse
from app.schemas.listing import ListingOut
from sqlalchemy.orm import selectinload


router = APIRouter(prefix="/watchlist", tags=["Watchlist"])

@router.post("", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(
    item: WatchlistCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if listing exists
    result = await db.execute(select(Listing).filter(Listing.listing_id == item.listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Check if already in watchlist
    result = await db.execute(
        select(Watchlist).filter(
            and_(
                Watchlist.user_id == current_user.user_id,
                Watchlist.listing_id == item.listing_id
            )
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already in watchlist")

    watchlist_item = Watchlist(user_id=current_user.user_id, listing_id=item.listing_id)
    db.add(watchlist_item)
    await db.commit()
    await db.refresh(watchlist_item)
    return watchlist_item

@router.get("", response_model=List[ListingOut])
async def get_watchlist(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100)
):
    query = (
    select(Listing)
    .options(selectinload(Listing.images))
    .join(Watchlist, Watchlist.listing_id == Listing.listing_id)
    .where(Watchlist.user_id == current_user.user_id)
    .order_by(desc(Watchlist.added_at))
    .offset(skip)
    .limit(limit)
)
    result = await db.execute(query)
    return result.scalars().all()

@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(
    listing_id: int = Path(..., ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Watchlist).filter(
            and_(
                Watchlist.user_id == current_user.user_id,
                Watchlist.listing_id == listing_id
            )
        )
    )
    watchlist_item = result.scalar_one_or_none()
    if not watchlist_item:
        raise HTTPException(status_code=404, detail="Not in watchlist")
    await db.delete(watchlist_item)
    await db.commit()