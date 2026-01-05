"""
Context Schemas

Request and response schemas for context operations.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.base import BaseSchema, TimestampSchema


class ContextTypeEnum(str, Enum):
    """Context type enumeration."""
    TEMPORAL = "temporal"
    SPATIAL = "spatial"
    SITUATIONAL = "situational"
    META = "meta"


class MemoryTierEnum(str, Enum):
    """Memory tier enumeration."""
    LONG_TERM = "long_term"
    SHORT_TERM = "short_term"
    EPHEMERAL = "ephemeral"


class DriftStatusEnum(str, Enum):
    """Drift status enumeration."""
    STABLE = "stable"
    DRIFTING = "drifting"
    CONFLICTING = "conflicting"
    STALE = "stale"


class ConfidenceLevel(str, Enum):
    """Confidence levels for context."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNKNOWN = "unknown"


class ContextSource(str, Enum):
    """Sources of context data."""
    CLIENT = "client"
    INFERRED = "inferred"
    USER = "user"
    SYSTEM = "system"
    SENSOR = "sensor"
    HISTORICAL = "historical"


@dataclass
class ContextConfidence:
    """
    Confidence information for context elements.
    
    Tracks how confident the system is in its interpretation.
    """
    score: float = 0.5
    level: ConfidenceLevel = ConfidenceLevel.MEDIUM
    factors: dict[str, float] = field(default_factory=dict)
    source: ContextSource = ContextSource.INFERRED
    
    def __post_init__(self):
        """Set level based on score if not explicitly set."""
        if self.score >= 0.8:
            self.level = ConfidenceLevel.HIGH
        elif self.score >= 0.5:
            self.level = ConfidenceLevel.MEDIUM
        elif self.score > 0:
            self.level = ConfidenceLevel.LOW
        else:
            self.level = ConfidenceLevel.UNKNOWN


class ContextSignals(BaseSchema):
    """
    Raw context signals provided by the client.
    
    These are normalized and interpreted by the context engines.
    """
    
    # Temporal signals
    timestamp: Optional[datetime] = Field(
        default=None,
        description="ISO 8601 timestamp with timezone"
    )
    timezone: Optional[str] = Field(
        default=None,
        description="IANA timezone identifier (e.g., 'America/New_York')"
    )
    
    # Spatial signals
    locale: Optional[str] = Field(
        default=None,
        description="BCP 47 locale code (e.g., 'en-US')"
    )
    country: Optional[str] = Field(
        default=None,
        description="ISO 3166-1 alpha-2 country code"
    )
    region: Optional[str] = Field(
        default=None,
        description="Region/state/province"
    )
    
    # Session signals
    session_id: Optional[str] = Field(
        default=None,
        description="Client-provided session identifier"
    )
    device_type: Optional[str] = Field(
        default=None,
        description="Device type (desktop, mobile, tablet)"
    )
    
    # Custom signals
    custom: Optional[dict[str, Any]] = Field(
        default=None,
        description="Custom context signals"
    )


class ContextInterpretation(BaseSchema):
    """
    Semantic interpretation of context.
    
    The meaningful understanding derived from raw signals.
    """
    
    # Temporal interpretation
    time_of_day: Optional[str] = Field(
        default=None,
        description="Semantic time (morning, afternoon, evening, night)"
    )
    day_type: Optional[str] = Field(
        default=None,
        description="Day semantics (weekday, weekend, holiday)"
    )
    urgency_default: Optional[str] = Field(
        default=None,
        description="Default urgency level (low, moderate, high)"
    )
    
    # Spatial interpretation
    cultural_context: Optional[str] = Field(
        default=None,
        description="Cultural context derived from location"
    )
    language_preference: Optional[str] = Field(
        default=None,
        description="Preferred language"
    )
    
    # Situational interpretation
    activity_inference: Optional[str] = Field(
        default=None,
        description="Inferred user activity"
    )
    
    # Raw interpretation data
    raw: Optional[dict[str, Any]] = Field(
        default=None,
        description="Additional interpretation data"
    )


class ContextCreate(BaseSchema):
    """Schema for creating a new context element."""
    
    context_type: ContextTypeEnum
    key: str = Field(min_length=1, max_length=255)
    value: dict[str, Any]
    memory_tier: MemoryTierEnum = MemoryTierEnum.SHORT_TERM
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    source: str = Field(default="client", max_length=100)
    expires_at: Optional[datetime] = None
    session_id: Optional[str] = None


class ContextUpdate(BaseSchema):
    """Schema for updating an existing context element."""
    
    value: Optional[dict[str, Any]] = None
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    memory_tier: Optional[MemoryTierEnum] = None
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None


class ContextResponse(TimestampSchema):
    """Schema for context response."""
    
    id: UUID
    user_id: UUID
    context_type: ContextTypeEnum
    memory_tier: MemoryTierEnum
    key: str
    value: dict[str, Any]
    interpretation: Optional[dict[str, Any]] = None
    confidence: float
    source: str
    drift_status: DriftStatusEnum
    last_confirmed_at: Optional[datetime] = None
    correction_count: int
    expires_at: Optional[datetime] = None
    is_active: bool
    session_id: Optional[str] = None
    
    # Computed fields
    is_expired: bool = False
    needs_confirmation: bool = False


class AnchorRequest(BaseSchema):
    """
    Request to anchor context for a user interaction.
    
    This is the primary entry point for context acquisition.
    """
    
    user_id: str = Field(description="External user identifier")
    signals: ContextSignals = Field(description="Raw context signals")
    message: Optional[str] = Field(
        default=None,
        description="User message to analyze for implicit context"
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Session identifier for continuity"
    )


class AnchorResponse(BaseSchema):
    """
    Response from context anchoring.
    
    Contains the anchored context and any interpretation.
    """
    
    anchor_id: UUID = Field(description="Unique identifier for this anchor")
    user_id: str
    session_id: str
    
    # Anchored context summary
    temporal: Optional[dict[str, Any]] = Field(
        default=None,
        description="Temporal context summary"
    )
    spatial: Optional[dict[str, Any]] = Field(
        default=None,
        description="Spatial context summary"
    )
    situational: Optional[dict[str, Any]] = Field(
        default=None,
        description="Situational context summary"
    )
    
    # Interpretation
    interpretation: ContextInterpretation
    
    # Confidence
    overall_confidence: float = Field(
        ge=0.0, le=1.0,
        description="Overall confidence in anchored context"
    )
    
    # Clarifications needed
    clarifications_needed: list[str] = Field(
        default_factory=list,
        description="List of low-confidence elements needing clarification"
    )
    
    # Timestamp
    anchored_at: datetime


class ContextListResponse(BaseSchema):
    """Response containing multiple context elements."""
    
    contexts: list[ContextResponse]
    total: int
    
    # Aggregated stats
    by_type: dict[str, int] = Field(
        default_factory=dict,
        description="Count of contexts by type"
    )
    by_tier: dict[str, int] = Field(
        default_factory=dict,
        description="Count of contexts by memory tier"
    )
    average_confidence: float = Field(
        default=0.0,
        description="Average confidence across all contexts"
    )


class ContextHistoryResponse(BaseSchema):
    """Response containing context version history."""
    
    context_id: UUID
    current_version: int
    versions: list[dict[str, Any]]
    total_changes: int
