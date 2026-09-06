from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, update
from typing import List, Optional, Tuple, Dict, Any

from ..models.user_models import User
from ..models.permission_model import Permission
from ..models.listing_model import Listing

async def get_users(
    db: AsyncSession, 
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None,
    status: Optional[str] = None
) -> Tuple[List[Dict[str, Any]], int]:
    """Get paginated list of users with optional filtering"""
    # Base query joining User and Permission
    query = select(
        User, 
        Permission.role_name
    ).outerjoin(
        Permission, 
        User.permission_id == Permission.permission_id
    )
    
    # Apply filters
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.email.ilike(search_term)) | 
            (User.first_name.ilike(search_term)) | 
            (User.last_name.ilike(search_term))
        )
    
    if status:
        query = query.filter(User.account_status == status)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.execute(count_query)
    total_count = total.scalar()
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    # Execute query
    result = await db.execute(query)
    users_with_roles = result.all()
    
    # Format results
    users_list = []
    for user, role_name in users_with_roles:
        users_list.append({
            "user_id": user.user_id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "registration_date": user.registration_date,
            "account_status": user.account_status,
            "verification_status": user.verification_status,
            "trust_score": user.trust_score,
            "permission_id": user.permission_id,
            "role_name": role_name if role_name else "User"
        })
    
    return users_list, total_count

async def get_user_with_permission(db: AsyncSession, user_id: int) -> Dict[str, Any]:
    """Get user with permission details"""
    query = select(
        User, 
        Permission.role_name
    ).outerjoin(
        Permission, 
        User.permission_id == Permission.permission_id
    ).filter(User.user_id == user_id)
    
    result = await db.execute(query)
    user_data = result.first()
    
    if not user_data:
        return None
    
    user, role_name = user_data
    
    return {
        "user_id": user.user_id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "registration_date": user.registration_date,
        "account_status": user.account_status,
        "verification_status": user.verification_status,
        "trust_score": user.trust_score,
        "permission_id": user.permission_id,
        "role_name": role_name if role_name else "User"
    }

async def update_user_permission(db: AsyncSession, user_id: int, role_name: str) -> bool:
    """Update user's permission"""
    # Get the permission for the role
    result = await db.execute(
        select(Permission).filter(Permission.role_name == role_name)
    )
    permission = result.scalar_one_or_none()
    
    if not permission:
        raise ValueError(f"Permission with role '{role_name}' not found")
    
    # Update the user's permission
    result = await db.execute(select(User).filter(User.user_id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise ValueError(f"User with ID {user_id} not found")
    
    user.permission_id = permission.permission_id
    await db.commit()
    return True

async def update_user_status(db: AsyncSession, user_id: int, status: str) -> bool:
    """Update user's account status"""
    result = await db.execute(select(User).filter(User.user_id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise ValueError(f"User with ID {user_id} not found")
    
    user.account_status = status
    await db.commit()
    return True

async def update_user_status_with_cascade(db: AsyncSession, user_id: int, status: str) -> bool:
    """Update user's account status with cascading effects on their listings"""
    result = await db.execute(select(User).filter(User.user_id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise ValueError(f"User with ID {user_id} not found")
    
    # Update user status
    user.account_status = status
    
    # If user is suspended or deactivated, update their listings
    if status in ["Suspended", "Deactivated"]:
        # Get all active listings by this user
        result = await db.execute(
            select(Listing)
            .filter(Listing.created_by == user_id)
            .filter(Listing.status == "Active")
        )
        listings = result.scalars().all()
        
        # Update each listing to be inactive
        for listing in listings:
            listing.status = "Expired" if status == "Deactivated" else "Reserved"
    
    await db.commit()
    return True

async def get_listings_admin(
    db: AsyncSession, 
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None,
    status: Optional[str] = None
) -> Tuple[List[Dict[str, Any]], int]:
    """Get paginated list of listings with user information"""
    query = select(
        Listing,
        User.email,
        User.first_name,
        User.last_name
    ).join(
        User, Listing.created_by == User.user_id
    )
    
    # Apply filters
    if search:
        search_term = f"%{search}%"
        query = query.filter(Listing.title.ilike(search_term))
    
    if status:
        query = query.filter(Listing.status == status)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.execute(count_query)
    total_count = total.scalar()
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    # Execute query
    result = await db.execute(query)
    listings_with_users = result.all()
    
    # Format results
    listings_list = []
    for listing, email, first_name, last_name in listings_with_users:
        listings_list.append({
            "listing_id": listing.listing_id,
            "title": listing.title,
            "price": listing.price,
            "created_by": listing.created_by,
            "user_email": email,
            "user_name": f"{first_name} {last_name}",
            "created_at": listing.created_at,
            "status": listing.status,
            "is_featured": listing.is_featured
        })
    
    return listings_list, total_count

async def update_listing_status(db: AsyncSession, listing_id: int, status: str) -> bool:
    """Update listing status"""
    result = await db.execute(select(Listing).filter(Listing.listing_id == listing_id))
    listing = result.scalar_one_or_none()
    
    if not listing:
        raise ValueError(f"Listing with ID {listing_id} not found")
    
    listing.status = status
    await db.commit()
    return True

async def feature_listing(db: AsyncSession, listing_id: int, is_featured: bool) -> bool:
    """Feature or unfeature a listing"""
    result = await db.execute(select(Listing).filter(Listing.listing_id == listing_id))
    listing = result.scalar_one_or_none()
    
    if not listing:
        raise ValueError(f"Listing with ID {listing_id} not found")
    
    listing.is_featured = is_featured
    await db.commit()
    return True

async def get_single_listing_admin(db: AsyncSession, listing_id: int):
    """Get a single listing for admin view, including user info"""
    result = await db.execute(
        select(
            Listing,
            User.email,
            User.first_name,
            User.last_name
        ).join(
            User, Listing.created_by == User.user_id
        ).filter(
            Listing.listing_id == listing_id
        )
    )
    listing_data = result.first()
    if not listing_data:
        return None
    listing, email, first_name, last_name = listing_data
    return {
        "listing_id": listing.listing_id,
        "title": listing.title,
        "price": listing.price,
        "created_by": listing.created_by,
        "user_email": email,
        "user_name": f"{first_name} {last_name}",
        "created_at": listing.created_at,
        "status": listing.status,
        "is_featured": listing.is_featured
        # Add more fields if you want!
    }
