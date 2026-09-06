from sqlalchemy import (
    Column,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    LargeBinary,
    Index,
    func,
)
from sqlalchemy.orm import relationship
from app.core.database import Base

# ────────────────────────────
class Conversation(Base):
    __tablename__ = "conversations"

    conversation_id = Column(Integer, primary_key=True, autoincrement=True)
    listing_id      = Column(Integer, ForeignKey("listings.listing_id", ondelete="CASCADE"), nullable=True)
    user1_id        = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    user2_id        = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    created_at      = Column(DateTime, server_default=func.current_timestamp())
    last_message_at = Column(DateTime, server_default=func.current_timestamp())
    is_active       = Column(Boolean, default=True)

    # ───────── relationships
    messages = relationship("Message", back_populates="conversation", cascade="all, delete", passive_deletes=True)

    __table_args__ = (
        Index("idx_conv_users", "user1_id", "user2_id"),
    )

# ────────────────────────────
class Message(Base):
    __tablename__ = "messages"

    message_id      = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("conversations.conversation_id", ondelete="CASCADE"), nullable=False)
    sender_id       = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    receiver_id     = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    listing_id      = Column(Integer, ForeignKey("listings.listing_id"), nullable=True)

    # encrypted payload (AES-GCM recommended)
    ciphertext      = Column(LargeBinary(length=1024), nullable=False)   # encrypted text + auth tag
    nonce           = Column(LargeBinary(length=12),  nullable=False)    # 12-byte GCM nonce

    sent_at         = Column(DateTime, server_default=func.current_timestamp())
    read_status     = Column(Boolean, default=False)
    read_at         = Column(DateTime, nullable=True)
    attachment_path = Column(LargeBinary(length=255), nullable=True)     # encrypted URL/filename

    # ───────── relationships
    conversation = relationship("Conversation", back_populates="messages")

    __table_args__ = (
        Index("idx_msg_conv_time", "conversation_id", "sent_at"),
    )
