from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..core.database import get_db
from ..core.security import get_current_user
from ..models.user_models import User
from ..models.permission_model import Permission

async def is_admin(
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    """Check if current user is an admin"""
    result = await db.execute(
        select(Permission).filter(Permission.permission_id == current_user.permission_id)
    )
    permission = result.scalar_one_or_none()
    
    if not permission or permission.role_name != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized. Admin access required."
        )
    return current_user

async def is_moderator_or_admin(
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    """Check if current user is a moderator or admin"""
    result = await db.execute(
        select(Permission).filter(Permission.permission_id == current_user.permission_id)
    )
    permission = result.scalar_one_or_none()
    
    if not permission or permission.role_name not in ["Admin", "Moderator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized. Moderator or Admin access required."
        )
    return current_user