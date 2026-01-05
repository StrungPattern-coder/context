"""
Temporal Context Engine

The core intelligence for understanding and reasoning about time.
Handles timezone awareness, time-of-day semantics, relative time
resolution, and midnight crossover scenarios.
"""

from datetime import datetime, date, time, timedelta
from enum import Enum
from typing import Any, Optional
from zoneinfo import ZoneInfo
import re

import structlog

from app.schemas.temporal import (
    TemporalContext,
    TemporalInterpretation,
    TimeOfDay,
    DayType,
    Season,
    UrgencyLevel,
    TimeReference,
    ResolvedTimeReference,
    TimeReferenceType,
    MidnightCrossoverContext,
)

logger = structlog.get_logger()


class TemporalEngine:
    """
    Temporal Context Engine
    
    Responsible for:
    - Interpreting raw timestamps into semantic meaning
    - Resolving relative time references ("today", "yesterday", "now")
    - Handling midnight crossover edge cases
    - Calculating time-of-day and day-type semantics
    - Managing session-relative time tracking
    
    This is NOT just a datetime library wrapper - it provides
    human-meaningful interpretation of time.
    """
    
    # Time-of-day boundaries (24-hour format)
    TIME_OF_DAY_RANGES = {
        TimeOfDay.LATE_NIGHT: (0, 5),     # 00:00 - 04:59
        TimeOfDay.EARLY_MORNING: (5, 8),  # 05:00 - 07:59
        TimeOfDay.MORNING: (8, 12),       # 08:00 - 11:59
        TimeOfDay.AFTERNOON: (12, 17),    # 12:00 - 16:59
        TimeOfDay.EVENING: (17, 21),      # 17:00 - 20:59
        TimeOfDay.NIGHT: (21, 24),        # 21:00 - 23:59
    }
    
    # Time-of-day human descriptions
    TIME_OF_DAY_DESCRIPTIONS = {
        TimeOfDay.LATE_NIGHT: "late at night",
        TimeOfDay.EARLY_MORNING: "early in the morning",
        TimeOfDay.MORNING: "in the morning",
        TimeOfDay.AFTERNOON: "in the afternoon",
        TimeOfDay.EVENING: "in the evening",
        TimeOfDay.NIGHT: "at night",
    }
    
    # Relative time patterns (case-insensitive)
    # NOTE: Longer patterns MUST come first to avoid partial matching
    RELATIVE_DAY_PATTERNS = {
        r"\bday before yesterday\b": -2,
        r"\bday after tomorrow\b": 2,
        r"\btoday\b": 0,
        r"\byesterday\b": -1,
        r"\btomorrow\b": 1,
    }
    
    RELATIVE_TIME_PATTERNS = {
        r"\bnow\b": "current",
        r"\bright now\b": "current",
        r"\bearlier\b": "past_session",
        r"\bjust now\b": "recent",
        r"\brecently\b": "recent",
        r"\ba moment ago\b": "recent",
        r"\bsoon\b": "near_future",
        r"\blater\b": "future_session",
        r"\bshortly\b": "near_future",
    }
    
    def __init__(self, default_timezone: str = "UTC"):
        """
        Initialize the Temporal Engine.
        
        Args:
            default_timezone: Fallback timezone when none provided
        """
        self.default_timezone = default_timezone
        logger.info(
            "Temporal engine initialized",
            default_timezone=default_timezone
        )
    
    def interpret(
        self,
        timestamp: datetime,
        timezone: Optional[str] = None,
        session_start: Optional[datetime] = None,
    ) -> TemporalContext:
        """
        Interpret a timestamp into full temporal context.
        
        This is the main entry point for temporal context acquisition.
        
        Args:
            timestamp: The datetime to interpret (should be timezone-aware)
            timezone: IANA timezone identifier
            session_start: When the session started (for relative calculations)
            
        Returns:
            Complete temporal context with semantic interpretation
        """
        # Ensure timezone awareness
        tz_str = timezone or self.default_timezone
        tz = ZoneInfo(tz_str)
        
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=tz)
        else:
            timestamp = timestamp.astimezone(tz)
        
        # Calculate UTC equivalent
        utc_timestamp = timestamp.astimezone(ZoneInfo("UTC"))
        
        # Calculate UTC offset
        utc_offset = timestamp.utcoffset()
        utc_offset_hours = utc_offset.total_seconds() / 3600 if utc_offset else 0
        
        # Determine time-of-day
        time_of_day = self._get_time_of_day(timestamp.hour)
        
        # Determine day type
        day_type = self._get_day_type(timestamp)
        
        # Determine season (Northern Hemisphere default)
        season = self._get_season(timestamp.month)
        
        # Calculate session duration if applicable
        session_duration = None
        if session_start:
            session_duration = (timestamp - session_start).total_seconds() / 60
        
        context = TemporalContext(
            timestamp=timestamp,
            timezone=tz_str,
            date=timestamp.date(),
            time=timestamp.time(),
            year=timestamp.year,
            month=timestamp.month,
            day=timestamp.day,
            hour=timestamp.hour,
            minute=timestamp.minute,
            weekday=timestamp.weekday(),
            weekday_name=timestamp.strftime("%A"),
            utc_offset_hours=utc_offset_hours,
            utc_timestamp=utc_timestamp,
            time_of_day=time_of_day,
            day_type=day_type,
            season=season,
            session_start=session_start,
            session_duration_minutes=session_duration,
        )
        
        logger.debug(
            "Temporal context interpreted",
            timestamp=str(timestamp),
            timezone=tz_str,
            time_of_day=time_of_day.value,
            day_type=day_type.value,
        )
        
        return context
    
    def get_interpretation(
        self,
        context: TemporalContext,
    ) -> TemporalInterpretation:
        """
        Generate semantic interpretation from temporal context.
        
        Converts raw time data into human-meaningful understanding.
        
        Args:
            context: The temporal context to interpret
            
        Returns:
            Semantic interpretation with reasoning
        """
        # Time-of-day semantics
        time_description = self.TIME_OF_DAY_DESCRIPTIONS[context.time_of_day]
        
        # Business hours check (9:00 - 17:00 on weekdays)
        is_business_hours = (
            context.day_type == DayType.WEEKDAY
            and 9 <= context.hour < 17
        )
        
        # Default urgency based on time
        urgency, urgency_reasoning = self._infer_urgency(context)
        
        # Days until weekend
        days_until_weekend = self._days_until_weekend(context.weekday)
        
        # Likely availability
        availability = self._infer_availability(context)
        
        return TemporalInterpretation(
            time_of_day=context.time_of_day,
            time_of_day_description=time_description,
            day_type=context.day_type,
            is_weekend=context.day_type == DayType.WEEKEND,
            is_business_hours=is_business_hours,
            default_urgency=urgency,
            urgency_reasoning=urgency_reasoning,
            days_until_weekend=days_until_weekend,
            is_end_of_day=context.hour >= 17,
            is_start_of_day=context.hour < 10,
            likely_availability=availability,
        )
    
    def resolve_reference(
        self,
        reference: TimeReference,
        anchor_context: TemporalContext,
        session_context: Optional[dict[str, Any]] = None,
    ) -> ResolvedTimeReference:
        """
        Resolve a relative or ambiguous time reference.
        
        This is the intelligence core - converting human language
        references like "today", "yesterday", "earlier" into
        concrete datetime values.
        
        Args:
            reference: The time reference to resolve
            anchor_context: Current temporal context for resolution
            session_context: Optional session data for "earlier" resolution
            
        Returns:
            Resolved time reference with confidence
        """
        text = reference.reference_text.lower().strip()
        
        # Try relative day patterns first
        for pattern, day_offset in self.RELATIVE_DAY_PATTERNS.items():
            if re.search(pattern, text, re.IGNORECASE):
                return self._resolve_relative_day(
                    text, day_offset, anchor_context
                )
        
        # Try relative time patterns
        for pattern, time_type in self.RELATIVE_TIME_PATTERNS.items():
            if re.search(pattern, text, re.IGNORECASE):
                return self._resolve_relative_time(
                    text, time_type, anchor_context, session_context
                )
        
        # Try to parse as absolute date/time
        absolute_result = self._try_parse_absolute(text, anchor_context)
        if absolute_result:
            return absolute_result
        
        # Unable to resolve - return low confidence result
        logger.warning(
            "Unable to resolve time reference",
            reference=text,
        )
        
        return ResolvedTimeReference(
            original_reference=reference.reference_text,
            reference_type=TimeReferenceType.IMPLICIT,
            resolved_start=anchor_context.timestamp,
            resolution_method="fallback_to_current",
            confidence=0.2,
            is_ambiguous=True,
            alternative_resolutions=[],
            human_readable=f"(unable to resolve '{text}', using current time)",
        )
    
    def handle_midnight_crossover(
        self,
        session_start: datetime,
        current_time: datetime,
        timezone: str,
    ) -> MidnightCrossoverContext:
        """
        Handle the special case where a session crosses midnight.
        
        When a user says "today" at 1 AM after starting a session
        at 11 PM the previous day, what do they mean?
        
        Args:
            session_start: When the session began
            current_time: Current timestamp
            timezone: User's timezone
            
        Returns:
            Midnight crossover context with interpretation
        """
        tz = ZoneInfo(timezone)
        session_start_local = session_start.astimezone(tz)
        current_local = current_time.astimezone(tz)
        
        session_date = session_start_local.date()
        current_date = current_local.date()
        has_crossed = session_date != current_date
        
        if not has_crossed:
            # Simple case - no crossover
            return MidnightCrossoverContext(
                session_started_date=session_date,
                current_date=current_date,
                has_crossed_midnight=False,
                today_interpretation="the current calendar day",
                today_date=current_date,
                yesterday_interpretation="the previous calendar day",
                yesterday_date=current_date - timedelta(days=1),
                confidence=0.95,
                reasoning="Session has not crossed midnight, standard interpretation applies.",
            )
        
        # Crossover detected - need to determine interpretation
        hours_since_midnight = current_local.hour + current_local.minute / 60
        hours_in_session = (current_time - session_start).total_seconds() / 3600
        
        # Heuristic: If it's very early (before 4 AM) and session is recent,
        # "today" likely means the day the session started
        if hours_since_midnight < 4 and hours_in_session < 6:
            today_date = session_date
            confidence = 0.7
            reasoning = (
                f"Session started at {session_start_local.strftime('%H:%M')} "
                f"and current time is {current_local.strftime('%H:%M')}. "
                f"Since it's early morning and the session is recent, "
                f"'today' likely refers to {session_date.strftime('%B %d')}."
            )
        else:
            # Default to calendar day
            today_date = current_date
            confidence = 0.85
            reasoning = (
                f"Session has crossed midnight. Using calendar day interpretation. "
                f"'Today' refers to {current_date.strftime('%B %d')}."
            )
        
        return MidnightCrossoverContext(
            session_started_date=session_date,
            current_date=current_date,
            has_crossed_midnight=True,
            today_interpretation=f"refers to {today_date.strftime('%A, %B %d')}",
            today_date=today_date,
            yesterday_interpretation=f"refers to {(today_date - timedelta(days=1)).strftime('%A, %B %d')}",
            yesterday_date=today_date - timedelta(days=1),
            confidence=confidence,
            reasoning=reasoning,
        )
    
    def _get_time_of_day(self, hour: int) -> TimeOfDay:
        """Determine time-of-day classification from hour."""
        for tod, (start, end) in self.TIME_OF_DAY_RANGES.items():
            if start <= hour < end:
                return tod
        return TimeOfDay.NIGHT  # Default fallback
    
    def _get_day_type(self, dt: datetime) -> DayType:
        """Determine day type (weekday/weekend)."""
        # Monday = 0, Sunday = 6
        if dt.weekday() >= 5:
            return DayType.WEEKEND
        return DayType.WEEKDAY
    
    def _get_season(self, month: int, southern_hemisphere: bool = False) -> Season:
        """
        Determine season from month.
        
        Args:
            month: Month number (1-12)
            southern_hemisphere: Flip seasons for southern hemisphere
        """
        seasons = {
            (12, 1, 2): Season.WINTER,
            (3, 4, 5): Season.SPRING,
            (6, 7, 8): Season.SUMMER,
            (9, 10, 11): Season.AUTUMN,
        }
        
        for months, season in seasons.items():
            if month in months:
                if southern_hemisphere:
                    # Flip seasons
                    flip = {
                        Season.WINTER: Season.SUMMER,
                        Season.SUMMER: Season.WINTER,
                        Season.SPRING: Season.AUTUMN,
                        Season.AUTUMN: Season.SPRING,
                    }
                    return flip[season]
                return season
        
        return Season.WINTER  # Default
    
    def _infer_urgency(
        self,
        context: TemporalContext,
    ) -> tuple[UrgencyLevel, str]:
        """Infer default urgency from temporal context."""
        
        # Late night / early morning = likely not urgent
        if context.time_of_day in (TimeOfDay.LATE_NIGHT, TimeOfDay.EARLY_MORNING):
            return (
                UrgencyLevel.LOW,
                "Late night/early morning suggests non-urgent context"
            )
        
        # Weekend = typically lower urgency
        if context.day_type == DayType.WEEKEND:
            return (
                UrgencyLevel.LOW,
                "Weekend suggests leisure time, lower default urgency"
            )
        
        # End of business day on weekday
        if context.day_type == DayType.WEEKDAY and context.hour >= 16:
            return (
                UrgencyLevel.MODERATE,
                "End of business day, moderate urgency"
            )
        
        # Business hours
        if context.day_type == DayType.WEEKDAY and 9 <= context.hour < 17:
            return (
                UrgencyLevel.MODERATE,
                "Business hours, standard working urgency"
            )
        
        return (
            UrgencyLevel.LOW,
            "Outside typical work hours"
        )
    
    def _days_until_weekend(self, weekday: int) -> int:
        """Calculate days until Saturday (weekday 5)."""
        if weekday >= 5:
            return 0  # Already weekend
        return 5 - weekday
    
    def _infer_availability(self, context: TemporalContext) -> str:
        """Infer likely user availability."""
        
        if context.time_of_day == TimeOfDay.LATE_NIGHT:
            return "likely sleeping or winding down"
        
        if context.time_of_day == TimeOfDay.EARLY_MORNING:
            return "likely waking up or preparing for day"
        
        if context.day_type == DayType.WEEKEND:
            if context.time_of_day in (TimeOfDay.MORNING, TimeOfDay.AFTERNOON):
                return "likely free (weekend daytime)"
            return "likely relaxing"
        
        # Weekday
        if 9 <= context.hour < 17:
            return "likely working"
        
        if context.hour >= 17:
            return "likely finished work, personal time"
        
        return "availability uncertain"
    
    def _resolve_relative_day(
        self,
        text: str,
        day_offset: int,
        anchor: TemporalContext,
    ) -> ResolvedTimeReference:
        """Resolve a relative day reference."""
        resolved_date = anchor.date + timedelta(days=day_offset)
        
        # Determine reference type
        ref_type = TimeReferenceType.RELATIVE_DAY
        
        # Create resolved datetime (start of day)
        resolved_start = datetime.combine(
            resolved_date,
            time(0, 0, 0),
            tzinfo=ZoneInfo(anchor.timezone)
        )
        
        # End of day
        resolved_end = datetime.combine(
            resolved_date,
            time(23, 59, 59),
            tzinfo=ZoneInfo(anchor.timezone)
        )
        
        return ResolvedTimeReference(
            original_reference=text,
            reference_type=ref_type,
            resolved_start=resolved_start,
            resolved_end=resolved_end,
            resolution_method=f"relative_day_offset_{day_offset}",
            confidence=0.95,
            is_ambiguous=False,
            alternative_resolutions=[],
            human_readable=resolved_date.strftime("%A, %B %d, %Y"),
        )
    
    def _resolve_relative_time(
        self,
        text: str,
        time_type: str,
        anchor: TemporalContext,
        session_context: Optional[dict[str, Any]],
    ) -> ResolvedTimeReference:
        """Resolve a relative time reference."""
        
        if time_type == "current":
            return ResolvedTimeReference(
                original_reference=text,
                reference_type=TimeReferenceType.RELATIVE_TIME,
                resolved_start=anchor.timestamp,
                resolution_method="current_moment",
                confidence=0.99,
                is_ambiguous=False,
                alternative_resolutions=[],
                human_readable=anchor.timestamp.strftime("%I:%M %p"),
            )
        
        if time_type == "recent":
            # "Just now", "recently" - within last 5-15 minutes
            resolved_start = anchor.timestamp - timedelta(minutes=15)
            return ResolvedTimeReference(
                original_reference=text,
                reference_type=TimeReferenceType.RELATIVE_TIME,
                resolved_start=resolved_start,
                resolved_end=anchor.timestamp,
                resolution_method="recent_window",
                confidence=0.75,
                is_ambiguous=True,
                alternative_resolutions=[
                    {"window": "5_minutes", "confidence": 0.5},
                    {"window": "30_minutes", "confidence": 0.6},
                ],
                human_readable="within the last few minutes",
            )
        
        if time_type == "past_session":
            # "Earlier" - earlier in the session
            if anchor.session_start:
                return ResolvedTimeReference(
                    original_reference=text,
                    reference_type=TimeReferenceType.RELATIVE_TIME,
                    resolved_start=anchor.session_start,
                    resolved_end=anchor.timestamp - timedelta(minutes=5),
                    resolution_method="session_earlier",
                    confidence=0.7,
                    is_ambiguous=True,
                    alternative_resolutions=[],
                    human_readable="earlier in this session",
                )
            # No session - interpret as earlier today
            return ResolvedTimeReference(
                original_reference=text,
                reference_type=TimeReferenceType.RELATIVE_TIME,
                resolved_start=datetime.combine(
                    anchor.date,
                    time(0, 0, 0),
                    tzinfo=ZoneInfo(anchor.timezone)
                ),
                resolved_end=anchor.timestamp,
                resolution_method="earlier_today",
                confidence=0.5,
                is_ambiguous=True,
                alternative_resolutions=[],
                human_readable="earlier today",
            )
        
        if time_type in ("near_future", "future_session"):
            # "Soon", "shortly", "later"
            minutes_ahead = 30 if time_type == "near_future" else 60
            return ResolvedTimeReference(
                original_reference=text,
                reference_type=TimeReferenceType.RELATIVE_TIME,
                resolved_start=anchor.timestamp,
                resolved_end=anchor.timestamp + timedelta(minutes=minutes_ahead),
                resolution_method=f"future_{minutes_ahead}m",
                confidence=0.6,
                is_ambiguous=True,
                alternative_resolutions=[],
                human_readable=f"within the next {minutes_ahead} minutes",
            )
        
        # Unknown type
        return ResolvedTimeReference(
            original_reference=text,
            reference_type=TimeReferenceType.IMPLICIT,
            resolved_start=anchor.timestamp,
            resolution_method="fallback",
            confidence=0.3,
            is_ambiguous=True,
            alternative_resolutions=[],
            human_readable="(time reference unclear)",
        )
    
    def _try_parse_absolute(
        self,
        text: str,
        anchor: TemporalContext,
    ) -> Optional[ResolvedTimeReference]:
        """Attempt to parse text as absolute date/time."""
        
        # Common date formats to try
        formats = [
            "%Y-%m-%d",
            "%m/%d/%Y",
            "%d/%m/%Y",
            "%B %d, %Y",
            "%B %d",
            "%b %d, %Y",
            "%b %d",
        ]
        
        for fmt in formats:
            try:
                parsed = datetime.strptime(text, fmt)
                
                # If no year in format, use current year
                if parsed.year == 1900:
                    parsed = parsed.replace(year=anchor.year)
                
                # Make timezone-aware
                parsed = parsed.replace(tzinfo=ZoneInfo(anchor.timezone))
                
                return ResolvedTimeReference(
                    original_reference=text,
                    reference_type=TimeReferenceType.ABSOLUTE,
                    resolved_start=parsed,
                    resolution_method=f"parsed_format_{fmt}",
                    confidence=0.9,
                    is_ambiguous=False,
                    alternative_resolutions=[],
                    human_readable=parsed.strftime("%A, %B %d, %Y"),
                )
            except ValueError:
                continue
        
        return None
    
    def format_for_prompt(
        self,
        context: TemporalContext,
        interpretation: TemporalInterpretation,
        verbose: bool = False,
    ) -> str:
        """
        Format temporal context for prompt injection.
        
        Args:
            context: The temporal context
            interpretation: The semantic interpretation
            verbose: Whether to include detailed interpretation
            
        Returns:
            Formatted string for prompt injection
        """
        parts = []
        
        # Core temporal facts
        parts.append(f"Current time: {context.timestamp.strftime('%A, %B %d, %Y at %I:%M %p %Z')}")
        
        if verbose:
            parts.append(f"Time of day: {interpretation.time_of_day_description}")
            parts.append(f"Day type: {'weekend' if interpretation.is_weekend else 'weekday'}")
            
            if interpretation.is_business_hours:
                parts.append("Currently within typical business hours")
            
            parts.append(f"Default urgency: {interpretation.default_urgency.value}")
        
        return "; ".join(parts)
