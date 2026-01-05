"""
Tenant Model

Multi-tenancy support for RAL. Each tenant represents an organization
or application that uses RAL services.
"""

from typing import TYPE_CHECKING, Optional
import uuid

from sqlalchemy import Boolean, String, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin
from app.models.compat import UUID, JSONB

if TYPE_CHECKING:
    from app.models.user import User


class Tenant(BaseModel, SoftDeleteMixin):
    """
    Tenant model for multi-tenancy.
    
    Each tenant is an isolated namespace with its own users,
    context data, and configuration.
    
    Attributes:
        name: Human-readable tenant name
        slug: URL-safe unique identifier
        api_key: Primary API key for authentication
        settings: Tenant-specific configuration
        is_active: Whether tenant is currently active
    """
    
    __tablename__ = "tenants"
    
    # Basic Information
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    
    slug: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
    
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    
    # Authentication
    api_key: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )
    
    api_key_secondary: Mapped[Optional[str]] = mapped_column(
        String(64),
        unique=True,
        nullable=True,
    )
    
    # Status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    
    # Configuration
    settings: Mapped[dict] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )
    
    # Limits
    max_users: Mapped[int] = mapped_column(
        Integer,
        default=100,
        nullable=False,
    )
    
    max_requests_per_minute: Mapped[int] = mapped_column(
        Integer,
        default=1000,
        nullable=False,
    )
    
    # Relationships
    users: Mapped[list["User"]] = relationship(
        "User",
        back_populates="tenant",
        lazy="selectin",
        passive_deletes=True,  # Let the database handle cascade deletes
    )
    
    def __repr__(self) -> str:
        return f"<Tenant(id={self.id}, slug={self.slug})>"
    
    @property
    def default_context_settings(self) -> dict:
        """Get tenant-specific context settings with defaults."""
        defaults = {
            "confidence_threshold": 0.5,
            "decay_hours": 24,
            "ephemeral_ttl_seconds": 3600,
            "max_context_tokens": 500,
        }
        return {**defaults, **self.settings.get("context", {})}
