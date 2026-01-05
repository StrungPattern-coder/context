"""
User Schemas

Request and response schemas for user operations.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import EmailStr, Field

from app.schemas.base import BaseSchema, TimestampSchema


class UserCreate(BaseSchema):
    """Schema for creating a new user."""
    
    external_id: str = Field(
        min_length=1,
        max_length=255,
        description="Client-provided user identifier"
    )
    email: Optional[EmailStr] = None
    display_name: Optional[str] = Field(
        default=None,
        max_length=255
    )
    
    # Default context settings
    default_timezone: Optional[str] = Field(
        default=None,
        description="IANA timezone identifier"
    )
    default_locale: Optional[str] = Field(
        default=None,
        description="BCP 47 locale code"
    )
    default_country: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=3,
        description="ISO country code"
    )
    
    # Privacy settings
    allow_location_tracking: bool = False
    allow_situational_tracking: bool = True
    
    # Custom preferences
    preferences: Optional[dict[str, Any]] = None


class UserUpdate(BaseSchema):
    """Schema for updating a user."""
    
    display_name: Optional[str] = Field(
        default=None,
        max_length=255
    )
    email: Optional[EmailStr] = None
    
    # Default context settings
    default_timezone: Optional[str] = None
    default_locale: Optional[str] = None
    default_country: Optional[str] = None
    
    # Privacy settings
    allow_location_tracking: Optional[bool] = None
    allow_situational_tracking: Optional[bool] = None
    
    # Status
    is_active: Optional[bool] = None
    
    # Custom preferences
    preferences: Optional[dict[str, Any]] = None


class UserResponse(TimestampSchema):
    """Schema for user response."""
    
    id: UUID
    external_id: str
    tenant_id: UUID
    
    email: Optional[str] = None
    display_name: Optional[str] = None
    
    # Default context settings
    default_timezone: Optional[str] = None
    default_locale: Optional[str] = None
    default_country: Optional[str] = None
    
    # Privacy settings
    allow_location_tracking: bool
    allow_situational_tracking: bool
    
    # Status
    is_active: bool
    
    # Computed properties
    effective_timezone: str
    effective_locale: str
    
    # Preferences (subset for response)
    preferences: dict[str, Any] = Field(default_factory=dict)


class UserContextSummary(BaseSchema):
    """Summary of a user's current context state."""
    
    user_id: UUID
    external_id: str
    
    # Context counts
    total_contexts: int
    active_contexts: int
    
    # By type
    temporal_contexts: int
    spatial_contexts: int
    situational_contexts: int
    
    # By tier
    long_term_contexts: int
    short_term_contexts: int
    ephemeral_contexts: int
    
    # Health
    average_confidence: float
    stale_contexts: int
    conflicting_contexts: int
    
    # Last activity
    last_context_update: Optional[datetime] = None
    active_session_id: Optional[str] = None


class UserPreferencesUpdate(BaseSchema):
    """Schema for updating user preferences."""
    
    # Context preferences
    auto_anchor_temporal: Optional[bool] = None
    auto_anchor_spatial: Optional[bool] = None
    auto_anchor_situational: Optional[bool] = None
    
    # Clarification preferences
    clarification_threshold: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0
    )
    verbose_anchoring: Optional[bool] = None
    
    # Privacy preferences
    allow_inference: Optional[bool] = None
    allow_history: Optional[bool] = None
    retention_days: Optional[int] = Field(
        default=None,
        ge=1,
        le=365
    )
    
    # Custom
    custom: Optional[dict[str, Any]] = None
