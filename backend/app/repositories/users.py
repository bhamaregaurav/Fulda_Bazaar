from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..models.user_models import User
from ..models.permission_model import Permission
from ..core.security import hash_password

import os



async def get_by_email(db: AsyncSession, email: str):
    result = await db.execute(select(User).filter(User.email == email))
    return result.scalars().first()

async def create(db: AsyncSession, user_data):
    # Step 1: Hash the password
    hashed = hash_password(user_data.password)

    # Step 2: Get the default 'User' permission
    result = await db.execute(select(Permission).filter(Permission.role_name == "User"))
    default_permission = result.scalars().first()

    if not default_permission:
        raise ValueError(
            "Default permission 'User' not found. Please seed the permissions table.")

   
    user = User(
        email=user_data.email,
        password=hashed,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        permission_id=default_permission.permission_id,
        profile_picture=user_data.profile_picture,  # This is now a URL string or None
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user