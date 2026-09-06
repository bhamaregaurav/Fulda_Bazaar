from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from ..core.database import get_db
from .dependencies import is_admin, is_moderator_or_admin
from . import repositories as admin_repo
from . import schemas
from ..models.user_models import User

router = APIRouter(prefix="/admin", tags=["Admin"])

# ─── User Management ─────────────────────────────────────────────────────

@router.get("/users", response_model=schemas.UsersList)
async def get_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_admin),
    page: int = Query(1, gt=0),
    size: int = Query(20, gt=0, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None
):
    """Get paginated list of users (admin only)"""
    try:
        skip = (page - 1) * size
        users, total = await admin_repo.get_users(db, skip, size, search, status)
        
        return schemas.UsersList(
            users=users,
            total=total,
            page=page,
            size=size
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching users: {str(e)}")

@router.get("/users/{user_id}", response_model=schemas.UserListItem)
async def get_user(
    user_id: int = Path(..., gt=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_admin)
):
    """Get a single user by ID (admin only)"""
    try:
        user = await admin_repo.get_user_with_permission(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user: {str(e)}")

@router.put("/users/{user_id}/permission", response_model=schemas.UserListItem)
async def update_user_permission(
    permission_data: schemas.UpdateUserPermission,
    user_id: int = Path(..., gt=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_admin)
):
    """Update user's role/permission (admin only)"""
    try:
        await admin_repo.update_user_permission(db, user_id, permission_data.role)
        updated_user = await admin_repo.get_user_with_permission(db, user_id)
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found after update")
        return updated_user
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating user permission: {str(e)}")

@router.put("/users/{user_id}/status", response_model=schemas.UserListItem)
async def update_user_status(
    status_data: schemas.UpdateUserStatus,
    user_id: int = Path(..., gt=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_admin)
):
    """Update user's account status with cascading effects (admin only)"""
    try:
        # Use the cascade function to update user status and handle their listings
        await admin_repo.update_user_status_with_cascade(db, user_id, status_data.status)
        
        # Get the updated user information
        updated_user = await admin_repo.get_user_with_permission(db, user_id)
        
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found after update")
        
        return updated_user
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating user status: {str(e)}")

# ─── Listing Management ────────────────────────────────────────────────────

@router.get("/listings", response_model=schemas.ListingsAdminList)
async def get_listings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_moderator_or_admin),
    page: int = Query(1, gt=0),
    size: int = Query(20, gt=0, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None
):
    """Get paginated list of listings for moderation (moderator/admin)"""
    try:
        skip = (page - 1) * size
        listings, total = await admin_repo.get_listings_admin(db, skip, size, search, status)
        
        return schemas.ListingsAdminList(
            listings=listings,
            total=total,
            page=page,
            size=size
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching listings: {str(e)}")

@router.put("/listings/{listing_id}/status", response_model=schemas.ListingAdminView)
async def update_listing_status(
    status_data: schemas.UpdateListingStatus,
    listing_id: int = Path(..., gt=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_moderator_or_admin)
):
    """Update listing status (moderator/admin)"""
    try:
        await admin_repo.update_listing_status(db, listing_id, status_data.status)
        
        # Get the specific updated listing
        updated_listing = await admin_repo.get_single_listing_admin(db, listing_id)
        if not updated_listing:
            raise HTTPException(status_code=404, detail="Listing not found after update")
        
        return updated_listing
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating listing status: {str(e)}")

@router.put("/listings/{listing_id}/feature", response_model=schemas.ListingAdminView)
async def feature_listing(
    feature_data: schemas.FeatureListingRequest,
    listing_id: int = Path(..., gt=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_moderator_or_admin)
):
    """Feature or unfeature a listing (moderator/admin)"""
    try:
        await admin_repo.feature_listing(db, listing_id, feature_data.is_featured)
        
        # Get the specific updated listing
        updated_listing = await admin_repo.get_single_listing_admin(db, listing_id)
        if not updated_listing:
            raise HTTPException(status_code=404, detail="Listing not found after update")
        
        return updated_listing
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error featuring listing: {str(e)}")
    
@router.get("/listings/{listing_id}", response_model=schemas.ListingAdminView)
async def get_listing(
    listing_id: int = Path(..., gt=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_moderator_or_admin)
):
    """Get a single listing by ID for admin/moderator view"""
    try:
        listing = await admin_repo.get_single_listing_admin(db, listing_id)
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        
        return listing
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching listing: {str(e)}")