from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.permission_model import Permission
from app.core.database import async_session

async def seed_permissions():
    async with async_session() as db:
        result = await db.execute(select(Permission))
        existing = result.scalars().all()
        if not existing:
            db.add_all([
                Permission(role_name="Admin", can_manage_users=True, can_moderate_content=True,
                           can_access_reports=True, can_view_logs=True,
                           can_post_listing=True, can_send_messages=True, can_manage_platform=True),
                Permission(role_name="Moderator", can_moderate_content=True,
                           can_access_reports=True, can_post_listing=True, can_send_messages=True),
                Permission(role_name="User", can_post_listing=True, can_send_messages=True)
            ])
            await db.commit()
