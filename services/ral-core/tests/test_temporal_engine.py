"""
Temporal Engine Validation Tests

Tests for temporal correctness including:
- Relative time resolution (today, yesterday, now)
- Midnight crossover handling
- Timezone awareness
- TTL expiry behavior

Test IDs: T-001 through T-010
"""

from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo
import pytest

from app.engines.temporal import TemporalEngine
from app.schemas.temporal import (
    TemporalContext,
    TimeReference,
    TimeReferenceType,
    TimeOfDay,
    DayType,
)


class TestRelativeDayResolution:
    """Tests for relative day references (today, yesterday, tomorrow)."""
    
    def test_t001_today_resolves_to_current_date(self, temporal_engine):
        """T-001: 'today' should resolve to current calendar date."""
        # Setup: Fixed timestamp
        now = datetime(2026, 1, 4, 10, 0, 0, tzinfo=ZoneInfo("UTC"))
        anchor = temporal_engine.interpret(timestamp=now)
        
        # Execute
        reference = TimeReference(reference_text="today")
        result = temporal_engine.resolve_reference(reference, anchor)
        
        # Verify
        assert result.resolved_start.date() == date(2026, 1, 4)
        assert result.confidence >= 0.9, "Today should have high confidence"
        assert result.reference_type == TimeReferenceType.RELATIVE_DAY
        assert not result.is_ambiguous
        assert "January 04, 2026" in result.human_readable or "January 4, 2026" in result.human_readable
    
    def test_t002_yesterday_resolves_to_previous_date(self, temporal_engine):
        """T-002: 'yesterday' should resolve to previous calendar date."""
        # Setup
        now = datetime(2026, 1, 4, 10, 0, 0, tzinfo=ZoneInfo("UTC"))
        anchor = temporal_engine.interpret(timestamp=now)
        
        # Execute
        reference = TimeReference(reference_text="yesterday")
        result = temporal_engine.resolve_reference(reference, anchor)
        
        # Verify
        assert result.resolved_start.date() == date(2026, 1, 3)
        assert result.confidence >= 0.9
        assert result.reference_type == TimeReferenceType.RELATIVE_DAY
    
    def test_tomorrow_resolves_to_next_date(self, temporal_engine):
        """'tomorrow' should resolve to next calendar date."""
        now = datetime(2026, 1, 4, 10, 0, 0, tzinfo=ZoneInfo("UTC"))
        anchor = temporal_engine.interpret(timestamp=now)
        
        reference = TimeReference(reference_text="tomorrow")
        result = temporal_engine.resolve_reference(reference, anchor)
        
        assert result.resolved_start.date() == date(2026, 1, 5)
        assert result.confidence >= 0.9
    
    def test_day_before_yesterday(self, temporal_engine):
        """'day before yesterday' should resolve correctly."""
        now = datetime(2026, 1, 4, 10, 0, 0, tzinfo=ZoneInfo("UTC"))
        anchor = temporal_engine.interpret(timestamp=now)
        
        reference = TimeReference(reference_text="day before yesterday")
        result = temporal_engine.resolve_reference(reference, anchor)
        
        assert result.resolved_start.date() == date(2026, 1, 2)
    
    def test_day_after_tomorrow(self, temporal_engine):
        """'day after tomorrow' should resolve correctly."""
        now = datetime(2026, 1, 4, 10, 0, 0, tzinfo=ZoneInfo("UTC"))
        anchor = temporal_engine.interpret(timestamp=now)
        
        reference = TimeReference(reference_text="day after tomorrow")
        result = temporal_engine.resolve_reference(reference, anchor)
        
        assert result.resolved_start.date() == date(2026, 1, 6)


class TestMidnightCrossover:
    """Tests for midnight boundary handling."""
    
    def test_t003_midnight_crossover_recent_session(self, temporal_engine):
        """T-003: Session crossing midnight with recent session start."""
        # Session started at 23:00 on Jan 3
        session_start = datetime(2026, 1, 3, 23, 0, 0, tzinfo=ZoneInfo("UTC"))
        # Current time is 00:30 on Jan 4
        current_time = datetime(2026, 1, 4, 0, 30, 0, tzinfo=ZoneInfo("UTC"))
        
        result = temporal_engine.handle_midnight_crossover(
            session_start=session_start,
            current_time=current_time,
            timezone="UTC",
        )
        
        # Verify crossover detected
        assert result.has_crossed_midnight is True
        assert result.session_started_date == date(2026, 1, 3)
        assert result.current_date == date(2026, 1, 4)
        
        # Confidence should reflect ambiguity
        assert 0.6 <= result.confidence <= 0.9
        
        # Reasoning should explain the interpretation
        assert len(result.reasoning) > 0
        assert "midnight" in result.reasoning.lower() or "session" in result.reasoning.lower()
    
    def test_midnight_crossover_no_crossover(self, temporal_engine):
        """Session that hasn't crossed midnight should be straightforward."""
        session_start = datetime(2026, 1, 4, 9, 0, 0, tzinfo=ZoneInfo("UTC"))
        current_time = datetime(2026, 1, 4, 15, 0, 0, tzinfo=ZoneInfo("UTC"))
        
        result = temporal_engine.handle_midnight_crossover(
            session_start=session_start,
            current_time=current_time,
            timezone="UTC",
        )
        
        assert result.has_crossed_midnight is False
        assert result.confidence >= 0.9
    
    def test_midnight_crossover_late_after_midnight(self, temporal_engine):
        """Session well past midnight should use calendar interpretation."""
        # Session started at 22:00 on Jan 3
        session_start = datetime(2026, 1, 3, 22, 0, 0, tzinfo=ZoneInfo("UTC"))
        # Current time is 10:00 on Jan 4 (well past midnight)
        current_time = datetime(2026, 1, 4, 10, 0, 0, tzinfo=ZoneInfo("UTC"))
        
        result = temporal_engine.handle_midnight_crossover(
            session_start=session_start,
            current_time=current_time,
            timezone="UTC",
        )
        
        assert result.has_crossed_midnight is True
        # Well past midnight, should use calendar day interpretation
        assert result.today_date == date(2026, 1, 4)
        assert result.confidence >= 0.8
    
    def test_midnight_boundary_just_before(self, temporal_engine, time_helper):
        """Test resolution just before midnight."""
        # 23:59 on Jan 3
        now = datetime(2026, 1, 3, 23, 59, 0, tzinfo=ZoneInfo("UTC"))
        anchor = temporal_engine.interpret(timestamp=now)
        
        reference = TimeReference(reference_text="today")
        result = temporal_engine.resolve_reference(reference, anchor)
        
        # Should still be Jan 3
        assert result.resolved_start.date() == date(2026, 1, 3)
    
    def test_midnight_boundary_just_after(self, temporal_engine):
        """Test resolution just after midnight."""
        # 00:01 on Jan 4
        now = datetime(2026, 1, 4, 0, 1, 0, tzinfo=ZoneInfo("UTC"))
        anchor = temporal_engine.interpret(timestamp=now)
        
        reference = TimeReference(reference_text="today")
        result = temporal_engine.resolve_reference(reference, anchor)
        
        # Should be Jan 4
        assert result.resolved_start.date() == date(2026, 1, 4)


class TestTimezoneAwareness:
    """Tests for timezone handling."""
    
    def test_t004_timezone_conversion(self, temporal_engine):
        """T-004: Correct timezone handling for local time references."""
        # User in EST (UTC-5)
        now_utc = datetime(2026, 1, 4, 15, 0, 0, tzinfo=ZoneInfo("UTC"))
        anchor = temporal_engine.interpret(
            timestamp=now_utc,
            timezone="America/New_York"  # EST
        )
        
        # Verify timezone is recorded
        assert anchor.timezone == "America/New_York"
        
        # Local hour should be 10 AM (15:00 UTC - 5 hours)
        assert anchor.hour == 10
    
    def test_timezone_interpretation_affects_time_of_day(self, temporal_engine):
        """Time of day should be interpreted in user's timezone."""
        # 22:00 UTC is 17:00 EST (evening) or 08:00 in Japan (morning)
        now_utc = datetime(2026, 1, 4, 22, 0, 0, tzinfo=ZoneInfo("UTC"))
        
        # EST interpretation
        anchor_est = temporal_engine.interpret(
            timestamp=now_utc,
            timezone="America/New_York"
        )
        # 22:00 UTC = 17:00 EST = evening
        assert anchor_est.time_of_day in [TimeOfDay.EVENING, TimeOfDay.AFTERNOON]
        
        # Japan interpretation
        anchor_japan = temporal_engine.interpret(
            timestamp=now_utc,
            timezone="Asia/Tokyo"
        )
        # 22:00 UTC = 07:00 JST next day = early morning
        assert anchor_japan.time_of_day in [TimeOfDay.EARLY_MORNING, TimeOfDay.MORNING]
    
    def test_date_boundary_timezone_difference(self, temporal_engine):
        """Date should be correct for user's timezone even if different from UTC."""
        # 23:00 UTC on Jan 4 = 08:00 Jan 5 in Tokyo
        now_utc = datetime(2026, 1, 4, 23, 0, 0, tzinfo=ZoneInfo("UTC"))
        
        anchor_tokyo = temporal_engine.interpret(
            timestamp=now_utc,
            timezone="Asia/Tokyo"
        )
        
        # In Tokyo, it's already Jan 5
        assert anchor_tokyo.date == date(2026, 1, 5)
    
    def test_utc_offset_calculation(self, temporal_engine):
        """UTC offset should be correctly calculated."""
        now = datetime(2026, 7, 4, 12, 0, 0, tzinfo=ZoneInfo("UTC"))
        
        # EST in summer (EDT, UTC-4)
        anchor = temporal_engine.interpret(
            timestamp=now,
            timezone="America/New_York"
        )
        
        # In July, EST observes DST so offset is -4
        assert -5 <= anchor.utc_offset_hours <= -4


class TestRelativeTimeResolution:
    """Tests for relative time references (now, earlier, soon)."""
    
    def test_t005_now_returns_current_moment(self, temporal_engine):
        """T-005: 'now' should return current moment with high confidence."""
        now = datetime(2026, 1, 4, 14, 30, 0, tzinfo=ZoneInfo("UTC"))
        anchor = temporal_engine.interpret(timestamp=now)
        
        reference = TimeReference(reference_text="now")
        result = temporal_engine.resolve_reference(reference, anchor)
        
        assert result.resolved_start == now
        assert result.confidence >= 0.95  # Very high confidence
        assert result.reference_type == TimeReferenceType.RELATIVE_TIME
        assert not result.is_ambiguous
    
    def test_t006_earlier_with_session_context(self, temporal_engine):
        """T-006: 'earlier' with session context should resolve to session window."""
        session_start = datetime(2026, 1, 4, 9, 0, 0, tzinfo=ZoneInfo("UTC"))
        now = datetime(2026, 1, 4, 14, 0, 0, tzinfo=ZoneInfo("UTC"))
        
        anchor = temporal_engine.interpret(
            timestamp=now,
            session_start=session_start
        )
        
        reference = TimeReference(reference_text="earlier")
        result = temporal_engine.resolve_reference(reference, anchor)
        
        # Should reference somewhere in the session
        assert result.resolved_start >= session_start
        assert result.resolved_end <= now
        assert result.confidence >= 0.6
    
    def test_t007_earlier_without_session_context(self, temporal_engine):
        """T-007: 'earlier' without session should resolve to earlier today with lower confidence."""
        now = datetime(2026, 1, 4, 14, 0, 0, tzinfo=ZoneInfo("UTC"))
        anchor = temporal_engine.interpret(timestamp=now, session_start=None)
        
        reference = TimeReference(reference_text="earlier")
        result = temporal_engine.resolve_reference(reference, anchor)
        
        # Should resolve to earlier today
        assert result.resolved_start.date() == now.date()
        # Lower confidence without session context
        assert result.confidence <= 0.6
        assert result.is_ambiguous
    
    def test_soon_resolves_to_near_future(self, temporal_engine):
        """'soon' should resolve to near future window."""
        now = datetime(2026, 1, 4, 14, 0, 0, tzinfo=ZoneInfo("UTC"))
        anchor = temporal_engine.interpret(timestamp=now)
        
        reference = TimeReference(reference_text="soon")
        result = temporal_engine.resolve_reference(reference, anchor)
        
        # Should be in the future
        assert result.resolved_start >= now
        # Within reasonable future window (e.g., 30 minutes to 1 hour)
        assert result.resolved_end <= now + timedelta(hours=2)
    
    def test_recently_resolves_to_past_window(self, temporal_engine):
        """'recently' should resolve to recent past window."""
        now = datetime(2026, 1, 4, 14, 0, 0, tzinfo=ZoneInfo("UTC"))
        anchor = temporal_engine.interpret(timestamp=now)
        
        reference = TimeReference(reference_text="recently")
        result = temporal_engine.resolve_reference(reference, anchor)
        
        # Should reference recent past
        assert result.resolved_end <= now
        assert result.resolved_start >= now - timedelta(minutes=30)


class TestTimeOfDayClassification:
    """Tests for time-of-day semantic classification."""
    
    def test_t009_morning_classification(self, temporal_engine):
        """T-009: Morning hours should be classified correctly."""
        test_cases = [
            (8, TimeOfDay.MORNING),
            (9, TimeOfDay.MORNING),
            (10, TimeOfDay.MORNING),
            (11, TimeOfDay.MORNING),
        ]
        
        for hour, expected in test_cases:
            now = datetime(2026, 1, 4, hour, 0, 0, tzinfo=ZoneInfo("UTC"))
            anchor = temporal_engine.interpret(timestamp=now)
            assert anchor.time_of_day == expected, f"Hour {hour} should be {expected}"
    
    def test_afternoon_classification(self, temporal_engine):
        """Afternoon hours should be classified correctly."""
        test_cases = [
            (12, TimeOfDay.AFTERNOON),
            (13, TimeOfDay.AFTERNOON),
            (14, TimeOfDay.AFTERNOON),
            (15, TimeOfDay.AFTERNOON),
            (16, TimeOfDay.AFTERNOON),
        ]
        
        for hour, expected in test_cases:
            now = datetime(2026, 1, 4, hour, 0, 0, tzinfo=ZoneInfo("UTC"))
            anchor = temporal_engine.interpret(timestamp=now)
            assert anchor.time_of_day == expected, f"Hour {hour} should be {expected}"
    
    def test_evening_classification(self, temporal_engine):
        """Evening hours should be classified correctly."""
        for hour in [17, 18, 19, 20]:
            now = datetime(2026, 1, 4, hour, 0, 0, tzinfo=ZoneInfo("UTC"))
            anchor = temporal_engine.interpret(timestamp=now)
            assert anchor.time_of_day == TimeOfDay.EVENING, f"Hour {hour} should be evening"
    
    def test_night_and_late_night_classification(self, temporal_engine):
        """Night and late night hours should be classified correctly."""
        # Late night: 0-4
        for hour in [0, 1, 2, 3, 4]:
            now = datetime(2026, 1, 4, hour, 0, 0, tzinfo=ZoneInfo("UTC"))
            anchor = temporal_engine.interpret(timestamp=now)
            assert anchor.time_of_day == TimeOfDay.LATE_NIGHT, f"Hour {hour} should be late_night"
        
        # Night: 21-23
        for hour in [21, 22, 23]:
            now = datetime(2026, 1, 4, hour, 0, 0, tzinfo=ZoneInfo("UTC"))
            anchor = temporal_engine.interpret(timestamp=now)
            assert anchor.time_of_day == TimeOfDay.NIGHT, f"Hour {hour} should be night"


class TestBusinessHoursDetection:
    """Tests for business hours detection."""
    
    def test_t010_weekday_business_hours(self, temporal_engine):
        """T-010: Weekday during business hours should be detected."""
        # Monday at 10 AM
        now = datetime(2026, 1, 5, 10, 0, 0, tzinfo=ZoneInfo("UTC"))  # Monday
        anchor = temporal_engine.interpret(timestamp=now)
        interpretation = temporal_engine.get_interpretation(anchor)
        
        assert anchor.day_type == DayType.WEEKDAY
        assert interpretation.is_business_hours is True
    
    def test_weekday_outside_business_hours(self, temporal_engine):
        """Weekday outside business hours should be detected."""
        # Monday at 10 PM
        now = datetime(2026, 1, 5, 22, 0, 0, tzinfo=ZoneInfo("UTC"))  # Monday
        anchor = temporal_engine.interpret(timestamp=now)
        interpretation = temporal_engine.get_interpretation(anchor)
        
        assert anchor.day_type == DayType.WEEKDAY
        assert interpretation.is_business_hours is False
    
    def test_weekend_detection(self, temporal_engine):
        """Weekend should be detected correctly."""
        # Saturday
        saturday = datetime(2026, 1, 3, 10, 0, 0, tzinfo=ZoneInfo("UTC"))
        anchor_sat = temporal_engine.interpret(timestamp=saturday)
        
        # Sunday
        sunday = datetime(2026, 1, 4, 10, 0, 0, tzinfo=ZoneInfo("UTC"))
        anchor_sun = temporal_engine.interpret(timestamp=sunday)
        
        assert anchor_sat.day_type == DayType.WEEKEND
        assert anchor_sun.day_type == DayType.WEEKEND
        
        interpretation_sat = temporal_engine.get_interpretation(anchor_sat)
        assert interpretation_sat.is_weekend is True


class TestUnresolveableReferences:
    """Tests for handling references that cannot be resolved."""
    
    def test_unknown_reference_low_confidence(self, temporal_engine):
        """Unknown references should return low confidence fallback."""
        now = datetime(2026, 1, 4, 10, 0, 0, tzinfo=ZoneInfo("UTC"))
        anchor = temporal_engine.interpret(timestamp=now)
        
        reference = TimeReference(reference_text="during the age of dinosaurs")
        result = temporal_engine.resolve_reference(reference, anchor)
        
        # Should fall back with low confidence
        assert result.confidence < 0.5
        assert result.is_ambiguous is True
    
    def test_ambiguous_reference_marked(self, temporal_engine):
        """Ambiguous references should be clearly marked."""
        now = datetime(2026, 1, 4, 10, 0, 0, tzinfo=ZoneInfo("UTC"))
        anchor = temporal_engine.interpret(timestamp=now)
        
        reference = TimeReference(reference_text="sometime")
        result = temporal_engine.resolve_reference(reference, anchor)
        
        # Should indicate ambiguity
        assert result.is_ambiguous is True or result.confidence < 0.5


class TestPromptFormatting:
    """Tests for formatting temporal context for prompt injection."""
    
    def test_format_includes_datetime(self, temporal_engine):
        """Formatted prompt should include readable datetime."""
        now = datetime(2026, 1, 4, 14, 30, 0, tzinfo=ZoneInfo("UTC"))
        anchor = temporal_engine.interpret(timestamp=now)
        interpretation = temporal_engine.get_interpretation(anchor)
        
        formatted = temporal_engine.format_for_prompt(anchor, interpretation)
        
        # Should contain date and time
        assert "January" in formatted or "Jan" in formatted
        assert "2026" in formatted
        assert ":" in formatted  # Time separator
    
    def test_verbose_format_includes_interpretation(self, temporal_engine):
        """Verbose format should include semantic interpretation."""
        now = datetime(2026, 1, 4, 14, 30, 0, tzinfo=ZoneInfo("UTC"))
        anchor = temporal_engine.interpret(timestamp=now)
        interpretation = temporal_engine.get_interpretation(anchor)
        
        formatted = temporal_engine.format_for_prompt(anchor, interpretation, verbose=True)
        
        # Should include semantic info
        assert "afternoon" in formatted.lower() or "time of day" in formatted.lower()


class TestSessionTracking:
    """Tests for session-relative time tracking."""
    
    def test_session_duration_calculation(self, temporal_engine):
        """Session duration should be correctly calculated."""
        session_start = datetime(2026, 1, 4, 9, 0, 0, tzinfo=ZoneInfo("UTC"))
        now = datetime(2026, 1, 4, 11, 30, 0, tzinfo=ZoneInfo("UTC"))
        
        anchor = temporal_engine.interpret(
            timestamp=now,
            session_start=session_start
        )
        
        # 2.5 hours = 150 minutes
        assert anchor.session_duration_minutes == 150
    
    def test_no_session_duration_without_start(self, temporal_engine):
        """Session duration should be None without session start."""
        now = datetime(2026, 1, 4, 11, 30, 0, tzinfo=ZoneInfo("UTC"))
        
        anchor = temporal_engine.interpret(timestamp=now, session_start=None)
        
        assert anchor.session_duration_minutes is None
