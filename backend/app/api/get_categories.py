from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.listing_model import Category
from ..core.database import get_db
from ..schemas.categories import CategoryOut
from typing import List

router = APIRouter()

@router.get("/categories", response_model=List[CategoryOut])
async def get_all_categories(db: AsyncSession = Depends(get_db)):
    """
    Returns all active categories.
    """
    result = await db.execute(
        select(Category).where(Category.is_active == True)
    )
    return result.scalars().all()
