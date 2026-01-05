"""
User Model

Represents users within the RAL system. Users are the primary entities
whose context is tracked and managed.
"""

from typing import TYPE_CHECKING, Optional
import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin
from app.models.compat import UUID, JSONB

if TYPE_CHECKING:
    from app.models.tenant import Tenant
    from app.models.context import Context


class User(BaseModel, SoftDeleteMixin):
    """
    User model representing individuals whose context is managed.
    
    Users belong to a tenant and have their own context data,
    preferences, and interaction history.
    
    Attributes:
        external_id: Client-provided user identifier
        tenant_id: Parent tenant
        email: Optional email for authentication
        preferences: User-specific settings
        is_active: Whether user is currently active
    """
    
    __tablename__ = "users"
    
    # External Identity
    external_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    
    # Tenant Relationship
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    tenant: Mapped["Tenant"] = relationship(
        "Tenant",
        back_populates="users",
    )
    
    # Optional Authentication
    email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    
    password_hash: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    
    # Profile
    display_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    
    # Status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    
    # User Preferences (affects context handling)
    preferences: Mapped[dict] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )
    
    # Default Context Settings
    default_timezone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    
    default_locale: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
    )
    
    default_country: Mapped[Optional[str]] = mapped_column(
        String(3),  # ISO 3166-1 alpha-3
        nullable=True,
    )
    
    # Privacy Settings
    allow_location_tracking: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    
    allow_situational_tracking: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    
    # Relationships
    contexts: Mapped[list["Context"]] = relationship(
        "Context",
        back_populates="user",
        lazy="selectin",
        cascade="all, delete-orphan",
        passive_deletes=True,  # Let the database handle cascade deletes
    )
    
    # Unique constraint on external_id per tenant
    __table_args__ = (
        # Composite unique constraint
        {"schema": None},
    )
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, external_id={self.external_id})>"
    
    @property
    def effective_timezone(self) -> str:
        """Get effective timezone with fallback to UTC."""
        return self.default_timezone or "UTC"
    
    @property
    def effective_locale(self) -> str:
        """Get effective locale with fallback to en-US."""
        return self.default_locale or "en-US"
    
    @property
    def context_preferences(self) -> dict:
        """Get context-related preferences with defaults."""
        defaults = {
            "auto_anchor_temporal": True,
            "auto_anchor_spatial": self.allow_location_tracking,
            "auto_anchor_situational": self.allow_situational_tracking,
            "clarification_threshold": 0.5,
            "verbose_anchoring": False,
        }
        return {**defaults, **self.preferences.get("context", {})}
