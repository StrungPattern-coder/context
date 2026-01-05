"""
Spatial Schemas

Schemas for spatial/location context handling.
"""

from enum import Enum
from typing import Any, Optional

from pydantic import Field, field_validator

from app.schemas.base import BaseSchema


class MeasurementSystem(str, Enum):
    """Measurement system preferences."""
    
    METRIC = "metric"
    IMPERIAL = "imperial"


class DateFormat(str, Enum):
    """Date format preferences."""
    
    MDY = "mdy"  # MM/DD/YYYY (US)
    DMY = "dmy"  # DD/MM/YYYY (Most of world)
    YMD = "ymd"  # YYYY-MM-DD (ISO)


class TimeFormat(str, Enum):
    """Time format preferences."""
    
    TWELVE_HOUR = "12h"
    TWENTY_FOUR_HOUR = "24h"


class SpatialContext(BaseSchema):
    """
    Comprehensive spatial context.
    
    Location, locale, and regional settings.
    """
    
    # Geographic location
    country_code: Optional[str] = Field(
        default=None,
        description="ISO 3166-1 alpha-2 country code",
        min_length=2,
        max_length=2,
    )
    country_name: Optional[str] = None
    
    region: Optional[str] = Field(
        default=None,
        description="State/province/region"
    )
    city: Optional[str] = None
    
    # Locale settings
    locale: str = Field(
        default="en-US",
        description="BCP 47 locale code"
    )
    language: str = Field(default="en")
    script: Optional[str] = None  # e.g., "Latn", "Cyrl"
    
    # Regional preferences
    timezone: Optional[str] = Field(
        default=None,
        description="IANA timezone (often derived from location)"
    )
    currency: Optional[str] = Field(
        default=None,
        description="ISO 4217 currency code"
    )
    
    # Format preferences
    measurement_system: MeasurementSystem = MeasurementSystem.METRIC
    date_format: DateFormat = DateFormat.YMD
    time_format: TimeFormat = TimeFormat.TWENTY_FOUR_HOUR
    
    # Privacy
    is_explicit_consent: bool = Field(
        default=False,
        description="Whether location was explicitly provided"
    )
    precision_level: str = Field(
        default="country",
        description="Location precision level (country, region, city)"
    )
    
    @field_validator("locale")
    @classmethod
    def validate_locale(cls, v: str) -> str:
        """Basic locale validation."""
        if not v or len(v) < 2:
            return "en-US"
        return v


class SpatialInterpretation(BaseSchema):
    """
    Semantic interpretation of spatial context.
    
    Cultural and regional understanding.
    """
    
    # Cultural context
    cultural_region: str = Field(
        description="Broad cultural region (Western, Eastern, etc.)"
    )
    primary_language: str
    formality_default: str = Field(
        description="Default formality level (formal, informal)"
    )
    
    # Communication style
    directness_preference: str = Field(
        description="Communication directness (direct, indirect)"
    )
    context_dependency: str = Field(
        description="High-context or low-context culture"
    )
    
    # Time perception
    time_orientation: str = Field(
        description="Monochronic or polychronic"
    )
    punctuality_expectation: str = Field(
        description="Strict, moderate, or relaxed"
    )
    
    # Business context
    business_hours_typical: str = Field(
        description="Typical business hours for region"
    )
    weekend_days: list[str] = Field(
        description="Weekend days in this region"
    )
    
    # Confidence
    confidence: float = Field(ge=0.0, le=1.0)
    inference_method: str


class LocationReference(BaseSchema):
    """
    A location reference that may need resolution.
    
    Input for spatial resolution.
    """
    
    reference_text: str = Field(
        description="Original text reference (e.g., 'here', 'home')"
    )
    reference_type: str = Field(
        default="unknown",
        description="Type of reference (relative, named, coordinate)"
    )


class ResolvedLocationReference(BaseSchema):
    """
    A resolved location reference.
    
    Output from spatial resolver.
    """
    
    original_reference: str
    
    # Resolution
    resolved_location: Optional[dict[str, Any]] = Field(
        default=None,
        description="Resolved location data"
    )
    
    # Confidence
    confidence: float = Field(ge=0.0, le=1.0)
    resolution_method: str
    
    # Fallback
    fell_back_to_default: bool = False
    default_reason: Optional[str] = None


class LocaleDefaults(BaseSchema):
    """
    Default settings derived from locale.
    
    Used when specific preferences aren't provided.
    """
    
    locale: str
    
    # Derived defaults
    language: str
    country: Optional[str] = None
    timezone_guess: Optional[str] = None
    
    # Format defaults
    date_format: DateFormat
    time_format: TimeFormat
    measurement_system: MeasurementSystem
    currency: Optional[str] = None
    
    # Cultural defaults
    formality_default: str = "neutral"
    greeting_style: str = "standard"
    
    # Confidence
    confidence: float = Field(ge=0.0, le=1.0)
