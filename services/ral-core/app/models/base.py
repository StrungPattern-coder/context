"""
Base Model Classes and Mixins

Provides common functionality for all database models including
timestamps, UUID primary keys, and standard fields.
"""

from datetime import datetime, timezone
from typing import Any
import uuid

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, declared_attr

from app.core.database import Base
from app.models.compat import UUID


class UUIDMixin:
    """
    Mixin providing UUID primary key.
    
    Automatically generates UUID v4 for new records.
    """
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )


class TimestampMixin:
    """
    Mixin providing automatic timestamp fields.
    
    - created_at: Set on insert
    - updated_at: Updated on every modification
    """
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SoftDeleteMixin:
    """
    Mixin providing soft delete functionality.
    
    Records are marked as deleted rather than being removed.
    """
    
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    
    @property
    def is_deleted(self) -> bool:
        """Check if record is soft deleted."""
        return self.deleted_at is not None
    
    def soft_delete(self) -> None:
        """Mark record as deleted."""
        self.deleted_at = datetime.now(timezone.utc)
    
    def restore(self) -> None:
        """Restore soft deleted record."""
        self.deleted_at = None


class BaseModel(Base, UUIDMixin, TimestampMixin):
    """
    Base model class for all database models.
    
    Combines UUID primary key and timestamp functionality.
    All models should inherit from this class.
    """
    
    __abstract__ = True
    
    def to_dict(self) -> dict[str, Any]:
        """
        Convert model to dictionary.
        
        Returns:
            Dictionary representation of model fields
        """
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
        }
    
    def __repr__(self) -> str:
        """String representation of model."""
        class_name = self.__class__.__name__
        pk = getattr(self, 'id', None)
        return f"<{class_name}(id={pk})>"
