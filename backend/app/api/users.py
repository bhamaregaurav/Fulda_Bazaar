from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.listing_model import Listing, ListingImage
from app.models.user_models import User
from app.models.permission_model import Permission
from app.models.review_model import Review
from app.schemas.users import (
    UserOut,
    UserUpdate,
    ListingUpdate,
    PublicUserOut,
)
from typing import Optional, List
from app.schemas.listing import ListingOut as userlist
from app.schemas.users import ListingOut
from geoalchemy2.elements import WKTElement
from decimal import Decimal
import os
import time

router = APIRouter(prefix="/users", tags=["Users"])

# ─────────────────────────────  GCS client  ───────────────────────────────
from app.core.storage import storage

@router.get("/listings", response_model=list[userlist])
async def get_own_listings(
    db: AsyncSession      = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    stmt = (
    select(Listing)
    .options(selectinload(Listing.images))
    .where(Listing.created_by == current_user.user_id)
    )
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/{user_id}", response_model=UserOut)
async def get_user_by_id(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user details by user_id"""
    # Fetch user with permission relationship
    query = select(User, Permission.role_name).outerjoin(
        Permission, User.permission_id == Permission.permission_id
    ).filter(User.user_id == user_id)
    result = await db.execute(query)
    user_data = result.first()
    
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    user, role_name = user_data
    
    # Create a copy of the user object
    user_dict = {c.name: getattr(user, c.name) for c in user.__table__.columns}
    # Add the role_name
    user_dict["role_name"] = role_name if role_name else "User"
    
    return user_dict

@router.put("/update/listings/{listing_id}", response_model=ListingOut)
async def update_own_listing(
    listing_id: int,
    title: str = Form(...),
    description: str = Form(...),
    category_id: int = Form(...),
    subcategory_id: Optional[int] = Form(None),
    listing_type: str = Form(...),
    price: Optional[Decimal] = Form(None),
    negotiable: bool = Form(False),
    condition: str = Form(...),
    location: Optional[str] = Form(None),
    latitude: float = Form(...),
    longitude: float = Form(...),
    images: Optional[str] = Form(default=None),  # Accept string for existing images
    new_images: List[UploadFile] = File(default=[]),  # Multiple new image uploads
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    listing = await db.get(Listing, listing_id)
    if not listing or listing.created_by != current_user.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    
    # Update basic fields
    listing.title = title
    listing.description = description
    listing.category_id = category_id
    listing.subcategory_id = subcategory_id
    listing.listing_type = listing_type
    listing.price = price
    listing.negotiable = negotiable
    listing.condition = condition
    listing.location = location
    
    # Update geo coordinates
    if latitude is not None and longitude is not None:
        listing.geo_coordinates = WKTElement(
            f"POINT({longitude} {latitude})", srid=4326
        )
    
    # Handle images
    if new_images and len(new_images) > 0:
        # If new images are uploaded, delete existing images and add the new ones
        existing_images_result = await db.execute(
            select(ListingImage).where(ListingImage.listing_id == listing_id)
        )
        existing_images = existing_images_result.scalars().all()
        for img in existing_images:
            await db.delete(img)
        
        # Enforce 7-image limit
        upload_count = min(len(new_images), 7)
        
        # Upload new images
        for idx, img in enumerate(new_images[:upload_count]):
            if img.filename:  # Only process if file is provided
                url = storage.upload(
                    f"listings/{listing_id}/{img.filename}", img.file, img.content_type
                )

                db.add(
                    ListingImage(
                        listing_id    = listing_id,
                        image_path    = url,
                        is_primary    = (idx == 0),
                        display_order = idx,
                    )
                )
    elif images is None or images == "":
        # If no images provided at all, clear existing images
        existing_images_result = await db.execute(
            select(ListingImage).where(ListingImage.listing_id == listing_id)
        )
        existing_images = existing_images_result.scalars().all()
        for img in existing_images:
            await db.delete(img)
    # else: Keep existing images (do nothing with images)
    
    try:
        await db.commit()
        await db.refresh(listing)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Invalid category or sub-category ID",
        ) from exc
    
    return listing
@router.delete("/del/listings/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_own_listing(
    listing_id: int,
    db: AsyncSession      = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    listing = await db.get(Listing, listing_id)
    if not listing or listing.created_by != current_user.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    await db.delete(listing)
    await db.commit()
    return
@router.get("/view/me", response_model=UserOut)
async def read_own_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Fetch user with permission relationship
    query = select(User, Permission.role_name).outerjoin(
        Permission, User.permission_id == Permission.permission_id
    ).filter(User.user_id == current_user.user_id)
    result = await db.execute(query)
    user_data = result.first()
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    user, role_name = user_data
    # Create a copy of the user object
    user_dict = {c.name: getattr(user, c.name) for c in user.__table__.columns}
    # Add the role_name
    user_dict["role_name"] = role_name if role_name else "User"
    return user_dict
@router.put("/update/me", response_model=UserOut)
async def update_own_profile(
    updates: UserUpdate,
    db: AsyncSession   = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, val in updates.dict(exclude_unset=True).items():
        setattr(current_user, field, val)
    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.put("/update/profile-picture", response_model=UserOut)
async def update_profile_picture(
    profile_picture: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the user's profile picture"""
    try:
        # Validate file type
        content_type = profile_picture.content_type
        if content_type not in ["image/jpeg", "image/png", "image/gif"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only JPEG, PNG and GIF files are allowed"
            )
        
        # Read file content to check if it's a valid image
        content = await profile_picture.read()
        if len(content) > 5 * 1024 * 1024:  # 5MB limit
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size should not exceed 5MB"
            )
            
        # Reset file position after reading
        await profile_picture.seek(0)
        
        # Try to delete the old profile picture if it exists
        if current_user.profile_picture:
            try:
                old_key = storage.key_from_url(current_user.profile_picture)
                if old_key:
                    storage.delete(old_key)
            except Exception as e:
                # Log the error but continue with the upload
                print(f"Error deleting old profile picture: {e}")
        
        # Upload to Google Cloud Storage with timestamp to avoid cache issues
        timestamp = int(time.time())
        safe_filename = profile_picture.filename.replace(" ", "_")
        blob_name = f"profiles/{current_user.email}/{timestamp}_{safe_filename}"
        profile_picture_url = storage.upload(
            blob_name, profile_picture.file, profile_picture.content_type
        )
        
        # Update user profile
        current_user.profile_picture = profile_picture_url
        await db.commit()
        await db.refresh(current_user)
        
        return current_user
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error processing profile picture: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing profile picture: {str(e)}"
        )

@router.delete("/remove/profile-picture", response_model=UserOut)
async def remove_profile_picture(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove the user's profile picture"""
    
    if current_user.profile_picture:
        try:
            old_key = storage.key_from_url(current_user.profile_picture)
            if old_key:
                storage.delete(old_key)
        except Exception as e:
            # Log the error but continue
            print(f"Error deleting profile picture: {e}")
    
    # Set profile picture to None
    current_user.profile_picture = None
    await db.commit()
    await db.refresh(current_user)
    
    return current_user

@router.get("/public/{user_id}", response_model=PublicUserOut)
async def get_public_user_profile(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get public profile of another user with non-sensitive data (requires authentication)"""
    

    user_query = select(User).filter(User.user_id == user_id)
    result = await db.execute(user_query)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    

    if user.account_status in ['Suspended', 'Deactivated']:
        raise HTTPException(status_code=404, detail="User profile not available")
    

    rating_stats_query = select(
        func.avg(Review.rating).label('average_rating'),
        func.count(Review.review_id).label('total_reviews')
    ).filter(Review.reviewee_id == user_id)
    
    rating_result = await db.execute(rating_stats_query)
    rating_stats = rating_result.first()
    

    positive_reviews_query = select(func.count(Review.review_id)).filter(
        Review.reviewee_id == user_id,
        Review.rating >= 4.0
    )
    neutral_reviews_query = select(func.count(Review.review_id)).filter(
        Review.reviewee_id == user_id,
        Review.rating >= 3.0,
        Review.rating < 4.0
    )
    negative_reviews_query = select(func.count(Review.review_id)).filter(
        Review.reviewee_id == user_id,
        Review.rating < 3.0
    )
    
    positive_result = await db.execute(positive_reviews_query)
    neutral_result = await db.execute(neutral_reviews_query)
    negative_result = await db.execute(negative_reviews_query)
    
    positive_reviews = positive_result.scalar() or 0
    neutral_reviews = neutral_result.scalar() or 0
    negative_reviews = negative_result.scalar() or 0
    

    listings_count_query = select(func.count(Listing.listing_id)).filter(
        Listing.created_by == user_id,
        Listing.status == 'Active'
    )
    listings_result = await db.execute(listings_count_query)
    listings_count = listings_result.scalar() or 0
    

    public_profile = {
        "user_id": user.user_id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "profile_picture": user.profile_picture,
        "bio": user.bio,
        "registration_date": user.registration_date,
        "account_status": user.account_status,
        "verification_status": user.verification_status,
        "trust_score": user.trust_score,
        "listings_count": listings_count,
        "average_rating": float(rating_stats.average_rating) if rating_stats.average_rating else None,
        "total_reviews": rating_stats.total_reviews or 0,
        "positive_reviews": positive_reviews,
        "neutral_reviews": neutral_reviews,
        "negative_reviews": negative_reviews,
    }
    
    return public_profile

@router.get("/public/{user_id}/guest", response_model=PublicUserOut)
async def get_public_user_profile_guest(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get public profile of another user with non-sensitive data (no authentication required)"""
    
    # Check if user exists
    user_query = select(User).filter(User.user_id == user_id)
    result = await db.execute(user_query)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    

    if user.account_status in ['Suspended', 'Deactivated']:
        raise HTTPException(status_code=404, detail="User profile not available")
    

    rating_stats_query = select(
        func.avg(Review.rating).label('average_rating'),
        func.count(Review.review_id).label('total_reviews')
    ).filter(Review.reviewee_id == user_id)
    
    rating_result = await db.execute(rating_stats_query)
    rating_stats = rating_result.first()
    

    positive_reviews_query = select(func.count(Review.review_id)).filter(
        Review.reviewee_id == user_id,
        Review.rating >= 4.0
    )
    neutral_reviews_query = select(func.count(Review.review_id)).filter(
        Review.reviewee_id == user_id,
        Review.rating >= 3.0,
        Review.rating < 4.0
    )
    negative_reviews_query = select(func.count(Review.review_id)).filter(
        Review.reviewee_id == user_id,
        Review.rating < 3.0
    )
    
    positive_result = await db.execute(positive_reviews_query)
    neutral_result = await db.execute(neutral_reviews_query)
    negative_result = await db.execute(negative_reviews_query)
    
    positive_reviews = positive_result.scalar() or 0
    neutral_reviews = neutral_result.scalar() or 0
    negative_reviews = negative_result.scalar() or 0
    

    listings_count_query = select(func.count(Listing.listing_id)).filter(
        Listing.created_by == user_id,
        Listing.status == 'Active'
    )
    listings_result = await db.execute(listings_count_query)
    listings_count = listings_result.scalar() or 0
    

    public_profile = {
        "user_id": user.user_id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "profile_picture": user.profile_picture,
        "bio": user.bio,
        "registration_date": user.registration_date,
        "account_status": user.account_status,
        "verification_status": user.verification_status,
        "trust_score": user.trust_score,
        "listings_count": listings_count,
        "average_rating": float(rating_stats.average_rating) if rating_stats.average_rating else None,
        "total_reviews": rating_stats.total_reviews or 0,
        "positive_reviews": positive_reviews,
        "neutral_reviews": neutral_reviews,
        "negative_reviews": negative_reviews,
    }
    
    return public_profile