"""
Context Models

Core models for context storage, versioning, and management.
This is the heart of RAL's data layer.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING, Optional, Any
import uuid

from sqlalchemy import (
    Boolean,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Enum as SQLEnum,
    DateTime,
    Index,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin
from app.models.compat import UUID, JSONB

if TYPE_CHECKING:
    from app.models.user import User


class ContextType(str, Enum):
    """
    Types of context that RAL manages.
    
    Each type has different handling, decay, and resolution logic.
    """
    TEMPORAL = "temporal"      # Time, date, timezone
    SPATIAL = "spatial"        # Location, locale, region
    SITUATIONAL = "situational"  # Tasks, conversation state
    META = "meta"              # Metadata about other context


class MemoryTier(str, Enum):
    """
    Memory tiers for context storage.
    
    Determines persistence, decay, and retrieval characteristics.
    """
    LONG_TERM = "long_term"      # User defaults, persistent
    SHORT_TERM = "short_term"    # Session-level, persisted
    EPHEMERAL = "ephemeral"      # Temporary, Redis-only


class DriftStatus(str, Enum):
    """
    Drift status for context elements.
    
    Indicates the health and reliability of context.
    """
    STABLE = "stable"           # Context is reliable
    DRIFTING = "drifting"       # Minor inconsistencies detected
    CONFLICTING = "conflicting" # Clear conflicts exist
    STALE = "stale"             # Context has decayed


class Context(BaseModel, SoftDeleteMixin):
    """
    Primary context storage model.
    
    Stores all context elements with confidence scoring,
    source tracking, and decay management.
    
    Attributes:
        user_id: Owner of this context
        context_type: Category of context
        memory_tier: Storage tier
        key: Context key (e.g., "timezone", "current_task")
        value: Context value (JSON)
        confidence: Confidence score (0.0-1.0)
        source: How context was acquired
        expires_at: Optional expiration
    """
    
    __tablename__ = "contexts"
    
    # Ownership
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    user: Mapped["User"] = relationship(
        "User",
        back_populates="contexts",
    )
    
    # Classification
    context_type: Mapped[ContextType] = mapped_column(
        SQLEnum(ContextType),
        nullable=False,
        index=True,
    )
    
    memory_tier: Mapped[MemoryTier] = mapped_column(
        SQLEnum(MemoryTier),
        default=MemoryTier.SHORT_TERM,
        nullable=False,
        index=True,
    )
    
    # Context Data
    key: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    
    value: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )
    
    # Semantic Interpretation
    interpretation: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
    )
    
    # Confidence & Trust
    confidence: Mapped[float] = mapped_column(
        Float,
        default=0.5,
        nullable=False,
    )
    
    source: Mapped[str] = mapped_column(
        String(100),
        default="inferred",
        nullable=False,
    )
    
    source_details: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
    )
    
    # Drift & Freshness
    drift_status: Mapped[DriftStatus] = mapped_column(
        SQLEnum(DriftStatus),
        default=DriftStatus.STABLE,
        nullable=False,
    )
    
    last_confirmed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    correction_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    
    # Lifecycle
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    
    # Session Tracking
    session_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )
    
    # Indexes and Constraints
    __table_args__ = (
        Index("ix_context_user_type_key", "user_id", "context_type", "key"),
        Index("ix_context_user_active", "user_id", "is_active"),
        Index("ix_context_expires", "expires_at", postgresql_where="expires_at IS NOT NULL"),
        CheckConstraint("confidence >= 0.0 AND confidence <= 1.0", name="confidence_range"),
    )
    
    def __repr__(self) -> str:
        return f"<Context(id={self.id}, type={self.context_type}, key={self.key})>"
    
    @property
    def is_expired(self) -> bool:
        """Check if context has expired."""
        if self.expires_at is None:
            return False
        return datetime.now(timezone.utc) > self.expires_at
    
    @property
    def is_high_confidence(self) -> bool:
        """Check if confidence is high (≥0.8)."""
        return self.confidence >= 0.8
    
    @property
    def is_low_confidence(self) -> bool:
        """Check if confidence is low (<0.5)."""
        return self.confidence < 0.5
    
    @property
    def needs_confirmation(self) -> bool:
        """Check if context should be confirmed with user."""
        return self.is_low_confidence or self.drift_status != DriftStatus.STABLE
    
    def decay_confidence(self, factor: float = 0.9) -> None:
        """Apply confidence decay with a floor of 0.1."""
        self.confidence = max(0.1, self.confidence * factor)
    
    def confirm(self) -> None:
        """Mark context as confirmed by user."""
        self.last_confirmed_at = datetime.now(timezone.utc)
        self.confidence = min(1.0, self.confidence + 0.2)
        self.drift_status = DriftStatus.STABLE
    
    def record_correction(self) -> None:
        """Record that user corrected this context."""
        self.correction_count += 1
        self.confidence = max(0.0, self.confidence - 0.2)
        if self.correction_count >= 3:
            self.drift_status = DriftStatus.CONFLICTING


class ContextVersion(BaseModel):
    """
    Version history for context changes.
    
    Maintains audit trail and enables rollback functionality.
    
    Attributes:
        context_id: Parent context
        version: Sequential version number
        value: Value at this version
        changed_by: Source of change
    """
    
    __tablename__ = "context_versions"
    
    # Parent Context
    context_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contexts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # Version Info
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    
    # Snapshot
    value: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )
    
    interpretation: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
    )
    
    confidence: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    
    # Change Metadata
    changed_by: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    
    change_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    
    previous_value: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
    )
    
    __table_args__ = (
        Index("ix_version_context_version", "context_id", "version"),
    )
    
    def __repr__(self) -> str:
        return f"<ContextVersion(context_id={self.context_id}, version={self.version})>"


class ContextSession(BaseModel):
    """
    Session tracking for context grouping.
    
    Groups related context updates within a user session.
    
    Attributes:
        user_id: Session owner
        session_id: Unique session identifier
        started_at: Session start time
        last_activity_at: Most recent activity
    """
    
    __tablename__ = "context_sessions"
    
    # Ownership
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # Session Identity
    session_id: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
    
    # Timing
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    
    last_activity_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    
    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    # Session Metadata
    client_info: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
    )
    
    # Aggregated Context Snapshot
    context_snapshot: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
    )
    
    @property
    def is_active(self) -> bool:
        """Check if session is still active."""
        return self.ended_at is None
    
    @property
    def duration_seconds(self) -> float:
        """Get session duration in seconds."""
        end = self.ended_at or datetime.now(timezone.utc)
        return (end - self.started_at).total_seconds()
