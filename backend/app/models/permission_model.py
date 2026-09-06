from sqlalchemy import Column, Integer, String, Boolean, Enum
from ..core.database import Base 
import enum


class RoleEnum(str, enum.Enum):
    Admin = "Admin"
    Moderator = "Moderator"
    User = "User"

class Permission(Base):
    __tablename__ = "permissions"

    permission_id = Column(Integer, primary_key=True, index=True)
    role_name = Column(Enum(RoleEnum), unique=True, nullable=False)

    can_manage_users = Column(Boolean, default=False)
    can_moderate_content = Column(Boolean, default=False)
    can_access_reports = Column(Boolean, default=False)
    can_view_logs = Column(Boolean, default=False)
    can_post_listing = Column(Boolean, default=True)
    can_send_messages = Column(Boolean, default=True)
    can_manage_platform = Column(Boolean, default=False)
