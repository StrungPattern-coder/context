"""
Temporal Schemas

Schemas for temporal context handling and time reference resolution.
"""

from datetime import datetime
from datetime import date as date_type
from datetime import time as time_type
from enum import Enum
from typing import Any, Optional
from zoneinfo import ZoneInfo

from pydantic import Field, field_validator, model_validator

from app.schemas.base import BaseSchema


class TimeOfDay(str, Enum):
    """Semantic time-of-day classifications."""
    
    EARLY_MORNING = "early_morning"  # 5:00 - 7:59
    MORNING = "morning"              # 8:00 - 11:59
    AFTERNOON = "afternoon"          # 12:00 - 16:59
    EVENING = "evening"              # 17:00 - 20:59
    NIGHT = "night"                  # 21:00 - 23:59
    LATE_NIGHT = "late_night"        # 0:00 - 4:59


class DayType(str, Enum):
    """Semantic day-type classifications."""
    
    WEEKDAY = "weekday"
    WEEKEND = "weekend"
    HOLIDAY = "holiday"  # Requires holiday data


class Season(str, Enum):
    """Season classifications."""
    
    SPRING = "spring"
    SUMMER = "summer"
    AUTUMN = "autumn"
    WINTER = "winter"


class UrgencyLevel(str, Enum):
    """Default urgency levels based on temporal context."""
    
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


class TemporalContext(BaseSchema):
    """
    Comprehensive temporal context.
    
    Contains both raw datetime data and semantic interpretation.
    """
    
    # Raw datetime components
    timestamp: datetime = Field(description="Timezone-aware timestamp")
    timezone: str = Field(description="IANA timezone identifier")
    
    # Derived components
    date: date_type = Field(description="Date component")
    time: time_type = Field(description="Time component")
    year: int
    month: int
    day: int
    hour: int
    minute: int
    weekday: int = Field(ge=0, le=6, description="0=Monday, 6=Sunday")
    weekday_name: str
    
    # UTC reference
    utc_offset_hours: float = Field(description="UTC offset in hours")
    utc_timestamp: datetime = Field(description="UTC equivalent")
    
    # Semantic interpretation
    time_of_day: TimeOfDay
    day_type: DayType
    season: Optional[Season] = None
    
    # Session tracking
    session_start: Optional[datetime] = None
    session_duration_minutes: Optional[float] = None
    
    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        """Validate timezone is a valid IANA identifier."""
        try:
            ZoneInfo(v)
            return v
        except KeyError:
            raise ValueError(f"Invalid timezone: {v}")


class TemporalInterpretation(BaseSchema):
    """
    Semantic interpretation of temporal context.
    
    Human-meaningful understanding of time.
    """
    
    # Time-of-day semantics
    time_of_day: TimeOfDay
    time_of_day_description: str = Field(
        description="Human-readable time description"
    )
    
    # Day semantics
    day_type: DayType
    is_weekend: bool
    is_business_hours: bool = Field(
        description="Within typical business hours (9-17)"
    )
    
    # Urgency inference
    default_urgency: UrgencyLevel
    urgency_reasoning: str = Field(
        description="Explanation for urgency inference"
    )
    
    # Relative positioning
    days_until_weekend: int = Field(ge=0, le=6)
    is_end_of_day: bool = Field(description="After 17:00")
    is_start_of_day: bool = Field(description="Before 10:00")
    
    # Cultural considerations
    likely_availability: str = Field(
        description="Likely user availability (free, working, sleeping)"
    )


class TimeReferenceType(str, Enum):
    """Types of time references that can be resolved."""
    
    ABSOLUTE = "absolute"      # "January 3, 2026"
    RELATIVE_DAY = "relative_day"  # "today", "yesterday", "tomorrow"
    RELATIVE_TIME = "relative_time"  # "now", "earlier", "soon"
    RELATIVE_PERIOD = "relative_period"  # "this week", "last month"
    IMPLICIT = "implicit"      # Inferred from context


class TimeReference(BaseSchema):
    """
    A time reference that needs resolution.
    
    Input for the temporal resolver.
    """
    
    reference_text: str = Field(
        description="Original text reference (e.g., 'today', 'now')"
    )
    reference_type: Optional[TimeReferenceType] = None
    context_hint: Optional[str] = Field(
        default=None,
        description="Additional context for resolution"
    )


class ResolvedTimeReference(BaseSchema):
    """
    A resolved time reference.
    
    Output from the temporal resolver.
    """
    
    original_reference: str
    reference_type: TimeReferenceType
    
    # Resolution
    resolved_start: datetime = Field(
        description="Start of resolved time range"
    )
    resolved_end: Optional[datetime] = Field(
        default=None,
        description="End of resolved time range (if range)"
    )
    
    # Resolution metadata
    resolution_method: str = Field(
        description="How the reference was resolved"
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="Confidence in resolution"
    )
    
    # Ambiguity
    is_ambiguous: bool = Field(
        default=False,
        description="Whether reference was ambiguous"
    )
    alternative_resolutions: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Alternative possible resolutions"
    )
    
    # Human-readable
    human_readable: str = Field(
        description="Human-readable resolved time"
    )


class MidnightCrossoverContext(BaseSchema):
    """
    Special handling for midnight crossover scenarios.
    
    When the session or reference crosses midnight.
    """
    
    session_started_date: date_type
    current_date: date_type
    has_crossed_midnight: bool
    
    # How to interpret "today"
    today_interpretation: str = Field(
        description="What 'today' means in this context"
    )
    today_date: date_type
    
    # How to interpret "yesterday"
    yesterday_interpretation: str
    yesterday_date: date_type
    
    # Confidence in interpretation
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str
