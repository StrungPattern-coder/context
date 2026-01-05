"""
Spatial Context Engine

Handles location, locale, and regional context interpretation.
Manages cultural defaults and geographic reasoning.
"""

from typing import Any, Optional
import re

import structlog

from app.schemas.spatial import (
    SpatialContext,
    SpatialInterpretation,
    MeasurementSystem,
    DateFormat,
    TimeFormat,
    LocaleDefaults,
    LocationReference,
    ResolvedLocationReference,
)

logger = structlog.get_logger()


# Locale to country mapping for common locales
LOCALE_COUNTRY_MAP = {
    "en-US": "US",
    "en-GB": "GB",
    "en-AU": "AU",
    "en-CA": "CA",
    "en-IN": "IN",
    "de-DE": "DE",
    "fr-FR": "FR",
    "es-ES": "ES",
    "es-MX": "MX",
    "pt-BR": "BR",
    "pt-PT": "PT",
    "ja-JP": "JP",
    "zh-CN": "CN",
    "zh-TW": "TW",
    "ko-KR": "KR",
    "ar-SA": "SA",
    "hi-IN": "IN",
    "ru-RU": "RU",
    "it-IT": "IT",
    "nl-NL": "NL",
}

# Country to timezone mapping (primary timezone)
COUNTRY_TIMEZONE_MAP = {
    "US": "America/New_York",  # Default to Eastern
    "GB": "Europe/London",
    "AU": "Australia/Sydney",
    "CA": "America/Toronto",
    "IN": "Asia/Kolkata",
    "DE": "Europe/Berlin",
    "FR": "Europe/Paris",
    "ES": "Europe/Madrid",
    "JP": "Asia/Tokyo",
    "CN": "Asia/Shanghai",
    "BR": "America/Sao_Paulo",
    "RU": "Europe/Moscow",
}

# Country to currency mapping
COUNTRY_CURRENCY_MAP = {
    "US": "USD",
    "GB": "GBP",
    "AU": "AUD",
    "CA": "CAD",
    "IN": "INR",
    "DE": "EUR",
    "FR": "EUR",
    "ES": "EUR",
    "JP": "JPY",
    "CN": "CNY",
    "BR": "BRL",
    "RU": "RUB",
}

# Countries using imperial system
IMPERIAL_COUNTRIES = {"US", "LR", "MM"}  # USA, Liberia, Myanmar

# Countries using 12-hour time commonly
TWELVE_HOUR_COUNTRIES = {"US", "CA", "AU", "IN", "PH", "MY", "EG"}

# Countries using MDY date format
MDY_COUNTRIES = {"US", "PH", "CA"}  # Though CA uses both

# Cultural regions
CULTURAL_REGIONS = {
    "western_europe": ["GB", "DE", "FR", "ES", "IT", "NL", "BE", "AT", "CH", "IE"],
    "eastern_europe": ["RU", "PL", "UA", "CZ", "HU", "RO", "BG"],
    "north_america": ["US", "CA", "MX"],
    "south_america": ["BR", "AR", "CO", "PE", "CL"],
    "east_asia": ["JP", "KR", "CN", "TW", "HK"],
    "south_asia": ["IN", "PK", "BD", "LK"],
    "southeast_asia": ["TH", "VN", "SG", "MY", "ID", "PH"],
    "middle_east": ["SA", "AE", "IL", "EG", "TR"],
    "oceania": ["AU", "NZ"],
    "africa": ["ZA", "NG", "KE", "EG"],
}


class SpatialEngine:
    """
    Spatial Context Engine
    
    Responsible for:
    - Interpreting locale codes into full context
    - Inferring regional preferences and defaults
    - Understanding cultural context
    - Managing location privacy
    
    This engine emphasizes EXPLICIT consent for location
    and INFERENCE for cultural defaults.
    """
    
    def __init__(self, default_locale: str = "en-US"):
        """
        Initialize the Spatial Engine.
        
        Args:
            default_locale: Fallback locale when none provided
        """
        self.default_locale = default_locale
        logger.info(
            "Spatial engine initialized",
            default_locale=default_locale
        )
    
    def interpret(
        self,
        locale: Optional[str] = None,
        country: Optional[str] = None,
        region: Optional[str] = None,
        timezone: Optional[str] = None,
        is_explicit_consent: bool = False,
    ) -> SpatialContext:
        """
        Interpret spatial signals into full context.
        
        Args:
            locale: BCP 47 locale code (e.g., "en-US")
            country: ISO 3166-1 alpha-2 country code
            region: State/province/region
            timezone: IANA timezone (can help infer location)
            is_explicit_consent: Whether user explicitly provided location
            
        Returns:
            Complete spatial context
        """
        # Parse locale
        effective_locale = locale or self.default_locale
        language, script, locale_country = self._parse_locale(effective_locale)
        
        # Determine country (explicit > locale > inference)
        effective_country = country or locale_country
        
        # Get country name
        country_name = self._get_country_name(effective_country) if effective_country else None
        
        # Infer timezone if not provided
        effective_timezone = timezone
        if not effective_timezone and effective_country:
            effective_timezone = COUNTRY_TIMEZONE_MAP.get(effective_country)
        
        # Determine currency
        currency = COUNTRY_CURRENCY_MAP.get(effective_country) if effective_country else None
        
        # Determine measurement system
        measurement = MeasurementSystem.IMPERIAL if effective_country in IMPERIAL_COUNTRIES else MeasurementSystem.METRIC
        
        # Determine date format
        date_format = DateFormat.MDY if effective_country in MDY_COUNTRIES else DateFormat.DMY
        
        # Determine time format
        time_format = TimeFormat.TWELVE_HOUR if effective_country in TWELVE_HOUR_COUNTRIES else TimeFormat.TWENTY_FOUR_HOUR
        
        # Determine precision level
        if region:
            precision = "region"
        elif effective_country:
            precision = "country"
        else:
            precision = "unknown"
        
        context = SpatialContext(
            country_code=effective_country,
            country_name=country_name,
            region=region,
            locale=effective_locale,
            language=language,
            script=script,
            timezone=effective_timezone,
            currency=currency,
            measurement_system=measurement,
            date_format=date_format,
            time_format=time_format,
            is_explicit_consent=is_explicit_consent,
            precision_level=precision,
        )
        
        logger.debug(
            "Spatial context interpreted",
            locale=effective_locale,
            country=effective_country,
            precision=precision,
        )
        
        return context
    
    def get_interpretation(
        self,
        context: SpatialContext,
    ) -> SpatialInterpretation:
        """
        Generate semantic interpretation of spatial context.
        
        Provides cultural and regional understanding.
        
        Args:
            context: The spatial context to interpret
            
        Returns:
            Semantic interpretation
        """
        # Determine cultural region
        cultural_region = "unknown"
        for region_name, countries in CULTURAL_REGIONS.items():
            if context.country_code in countries:
                cultural_region = region_name
                break
        
        # Infer communication style based on cultural region
        directness, context_dependency = self._infer_communication_style(cultural_region)
        
        # Infer formality
        formality = self._infer_formality(cultural_region, context.language)
        
        # Infer time orientation
        time_orientation, punctuality = self._infer_time_culture(cultural_region)
        
        # Business hours (rough defaults)
        business_hours = self._get_business_hours(cultural_region)
        
        # Weekend days
        weekend_days = self._get_weekend_days(context.country_code)
        
        # Confidence based on how much we know
        confidence = 0.9 if context.is_explicit_consent else 0.6
        if context.precision_level == "unknown":
            confidence = 0.3
        
        return SpatialInterpretation(
            cultural_region=cultural_region.replace("_", " ").title(),
            primary_language=context.language,
            formality_default=formality,
            directness_preference=directness,
            context_dependency=context_dependency,
            time_orientation=time_orientation,
            punctuality_expectation=punctuality,
            business_hours_typical=business_hours,
            weekend_days=weekend_days,
            confidence=confidence,
            inference_method="locale_and_country_based" if context.country_code else "language_based",
        )
    
    def get_locale_defaults(self, locale: str) -> LocaleDefaults:
        """
        Get default settings for a locale.
        
        Args:
            locale: BCP 47 locale code
            
        Returns:
            Locale defaults
        """
        language, script, country = self._parse_locale(locale)
        
        # Infer country from locale if not in code
        if not country:
            country = LOCALE_COUNTRY_MAP.get(locale)
        
        # Get timezone guess
        timezone_guess = COUNTRY_TIMEZONE_MAP.get(country) if country else None
        
        # Determine formats
        date_format = DateFormat.MDY if country in MDY_COUNTRIES else DateFormat.DMY
        time_format = TimeFormat.TWELVE_HOUR if country in TWELVE_HOUR_COUNTRIES else TimeFormat.TWENTY_FOUR_HOUR
        measurement = MeasurementSystem.IMPERIAL if country in IMPERIAL_COUNTRIES else MeasurementSystem.METRIC
        currency = COUNTRY_CURRENCY_MAP.get(country) if country else None
        
        # Confidence based on specificity
        confidence = 0.9 if country else 0.5
        
        return LocaleDefaults(
            locale=locale,
            language=language,
            country=country,
            timezone_guess=timezone_guess,
            date_format=date_format,
            time_format=time_format,
            measurement_system=measurement,
            currency=currency,
            confidence=confidence,
        )
    
    def resolve_location_reference(
        self,
        reference: LocationReference,
        user_context: Optional[SpatialContext] = None,
    ) -> ResolvedLocationReference:
        """
        Resolve a location reference like "here" or "home".
        
        Args:
            reference: The location reference to resolve
            user_context: User's spatial context for resolution
            
        Returns:
            Resolved location with confidence
        """
        text = reference.reference_text.lower().strip()
        
        # Handle "here" reference
        if text in ("here", "this location", "current location"):
            if user_context and user_context.is_explicit_consent:
                return ResolvedLocationReference(
                    original_reference=reference.reference_text,
                    resolved_location={
                        "country": user_context.country_code,
                        "country_name": user_context.country_name,
                        "region": user_context.region,
                    },
                    confidence=0.9,
                    resolution_method="user_context",
                    fell_back_to_default=False,
                )
            
            # No location consent - return low confidence
            return ResolvedLocationReference(
                original_reference=reference.reference_text,
                resolved_location=None,
                confidence=0.2,
                resolution_method="no_location_consent",
                fell_back_to_default=True,
                default_reason="Location not available - user has not provided location consent",
            )
        
        # Handle "home" reference - would need user profile data
        if text in ("home", "my place"):
            return ResolvedLocationReference(
                original_reference=reference.reference_text,
                resolved_location=None,
                confidence=0.1,
                resolution_method="named_location_not_stored",
                fell_back_to_default=True,
                default_reason="Named location 'home' not configured for user",
            )
        
        # Unknown reference
        return ResolvedLocationReference(
            original_reference=reference.reference_text,
            resolved_location=None,
            confidence=0.1,
            resolution_method="unrecognized",
            fell_back_to_default=True,
            default_reason=f"Unable to resolve location reference: {text}",
        )
    
    def _parse_locale(self, locale: str) -> tuple[str, Optional[str], Optional[str]]:
        """
        Parse BCP 47 locale code.
        
        Args:
            locale: Locale code (e.g., "en-US", "zh-Hans-CN")
            
        Returns:
            Tuple of (language, script, country)
        """
        parts = locale.replace("_", "-").split("-")
        
        language = parts[0].lower() if parts else "en"
        script = None
        country = None
        
        if len(parts) >= 2:
            # Could be script (4 chars, title case) or country (2 chars, upper)
            second = parts[1]
            if len(second) == 4 and second.istitle():
                script = second
                if len(parts) >= 3:
                    country = parts[2].upper()
            elif len(second) == 2:
                country = second.upper()
        
        return language, script, country
    
    def _get_country_name(self, code: str) -> Optional[str]:
        """Get country name from code."""
        # Simple mapping - in production, use pycountry or similar
        names = {
            "US": "United States",
            "GB": "United Kingdom",
            "AU": "Australia",
            "CA": "Canada",
            "IN": "India",
            "DE": "Germany",
            "FR": "France",
            "ES": "Spain",
            "JP": "Japan",
            "CN": "China",
            "BR": "Brazil",
            "RU": "Russia",
            "MX": "Mexico",
            "IT": "Italy",
            "NL": "Netherlands",
            "KR": "South Korea",
            "SA": "Saudi Arabia",
            "AE": "United Arab Emirates",
        }
        return names.get(code)
    
    def _infer_communication_style(
        self,
        cultural_region: str,
    ) -> tuple[str, str]:
        """Infer directness and context dependency from cultural region."""
        
        # High-context, indirect cultures
        if cultural_region in ("east_asia", "southeast_asia", "middle_east"):
            return "indirect", "high-context"
        
        # Low-context, direct cultures
        if cultural_region in ("north_america", "western_europe"):
            return "direct", "low-context"
        
        # Mixed
        return "moderate", "medium-context"
    
    def _infer_formality(self, cultural_region: str, language: str) -> str:
        """Infer default formality level."""
        
        # Languages with strong formal registers
        formal_languages = {"ja", "ko", "de", "fr"}
        if language in formal_languages:
            return "formal"
        
        # Regions with formal defaults
        if cultural_region in ("east_asia", "middle_east"):
            return "formal"
        
        # North America tends informal
        if cultural_region == "north_america":
            return "informal"
        
        return "neutral"
    
    def _infer_time_culture(
        self,
        cultural_region: str,
    ) -> tuple[str, str]:
        """Infer time orientation and punctuality expectations."""
        
        # Monochronic, strict punctuality
        if cultural_region in ("western_europe", "north_america", "east_asia"):
            return "monochronic", "strict"
        
        # Polychronic, relaxed punctuality
        if cultural_region in ("south_america", "middle_east", "south_asia"):
            return "polychronic", "relaxed"
        
        return "mixed", "moderate"
    
    def _get_business_hours(self, cultural_region: str) -> str:
        """Get typical business hours for region."""
        
        if cultural_region in ("east_asia",):
            return "9:00 - 18:00 (often longer)"
        
        if cultural_region in ("western_europe",):
            return "9:00 - 17:00"
        
        if cultural_region in ("middle_east",):
            return "8:00 - 16:00 (Sunday-Thursday typical)"
        
        return "9:00 - 17:00"
    
    def _get_weekend_days(self, country_code: Optional[str]) -> list[str]:
        """Get weekend days for country."""
        
        # Middle Eastern countries with Fri-Sat weekend
        friday_saturday = {"SA", "AE", "KW", "BH", "QA", "OM", "YE", "AF"}
        if country_code in friday_saturday:
            return ["Friday", "Saturday"]
        
        # Israel: Fri-Sat
        if country_code == "IL":
            return ["Friday", "Saturday"]
        
        # Default: Sat-Sun
        return ["Saturday", "Sunday"]
    
    def format_for_prompt(
        self,
        context: SpatialContext,
        interpretation: SpatialInterpretation,
        verbose: bool = False,
    ) -> str:
        """
        Format spatial context for prompt injection.
        
        Args:
            context: The spatial context
            interpretation: The semantic interpretation
            verbose: Whether to include detailed interpretation
            
        Returns:
            Formatted string for prompt injection
        """
        parts = []
        
        # Basic location info (only if consented)
        if context.country_name and context.is_explicit_consent:
            location = context.country_name
            if context.region:
                location = f"{context.region}, {location}"
            parts.append(f"User location: {location}")
        
        # Locale and language
        parts.append(f"Language preference: {context.language.upper()}")
        
        if verbose:
            parts.append(f"Cultural context: {interpretation.cultural_region}")
            parts.append(f"Communication style: {interpretation.directness_preference}")
            
            if context.measurement_system == MeasurementSystem.IMPERIAL:
                parts.append("Uses imperial measurements (miles, °F)")
            else:
                parts.append("Uses metric measurements (km, °C)")
        
        return "; ".join(parts)
