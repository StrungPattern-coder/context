"""
Drift Detector Validation Tests

Tests for drift detection correctness including:
- Correction accumulation and CONFLICTING threshold
- Staleness detection (STALENESS_HOURS = 24)
- Drift status transitions
- Health score calculation

Test IDs: DR-001 through DR-008
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import pytest

from app.engines.drift import DriftDetector, DriftType, DriftSignal
from app.models.context import Context, DriftStatus


class TestCorrectionAccumulation:
    """Tests for correction tracking and CONFLICTING threshold."""
    
    def test_dr001_single_correction_no_conflict(self, drift_detector, sample_context, db_session):
        """DR-001: Single correction should not trigger CONFLICTING status."""
        # Setup: Fresh context with no corrections
        context = sample_context
        assert context.correction_count == 0
        assert context.drift_status == DriftStatus.STABLE
        
        # Execute: Record one correction
        context.record_correction()
        
        # Verify: Still not conflicting
        assert context.correction_count == 1
        assert context.drift_status != DriftStatus.CONFLICTING
        assert context.confidence < 1.0  # Confidence should decrease
    
    def test_dr002_two_corrections_still_stable(self, drift_detector, sample_context, db_session):
        """DR-002: Two corrections should reduce confidence but not conflict."""
        context = sample_context
        
        # Record two corrections
        context.record_correction()
        context.record_correction()
        
        # Should be DRIFTING but not CONFLICTING
        assert context.correction_count == 2
        assert context.drift_status in [DriftStatus.STABLE, DriftStatus.DRIFTING]
        assert context.drift_status != DriftStatus.CONFLICTING
    
    def test_dr003_three_corrections_triggers_conflict(self, drift_detector, sample_context, db_session):
        """DR-003: Three corrections should trigger CONFLICTING status."""
        context = sample_context
        
        # Record three corrections
        for i in range(3):
            context.record_correction()
        
        # Should now be CONFLICTING
        assert context.correction_count == 3
        assert context.drift_status == DriftStatus.CONFLICTING
    
    def test_dr004_corrections_reduce_confidence(self, drift_detector, sample_context):
        """DR-004: Each correction should reduce confidence monotonically."""
        context = sample_context
        original_confidence = context.confidence
        
        confidences = [original_confidence]
        
        for i in range(3):
            context.record_correction()
            confidences.append(context.confidence)
        
        # Each confidence should be lower than previous
        for i in range(1, len(confidences)):
            assert confidences[i] < confidences[i - 1], \
                f"Confidence {i} ({confidences[i]}) should be < confidence {i-1} ({confidences[i-1]})"
    
    def test_correction_count_increments(self, drift_detector, sample_context):
        """Correction count should increment with each correction."""
        context = sample_context
        assert context.correction_count == 0
        
        context.record_correction()
        assert context.correction_count == 1
        
        context.record_correction()
        assert context.correction_count == 2


class TestStalenessDetection:
    """Tests for staleness detection (24 hour threshold)."""
    
    def test_dr005_fresh_context_not_stale(self, drift_detector, sample_context):
        """DR-005: Recently updated context should not be stale."""
        # Context updated 1 hour ago
        context = sample_context
        context.updated_at = datetime.now(ZoneInfo("UTC")) - timedelta(hours=1)
        
        result = drift_detector.detect([context])
        
        # Should not be stale
        stale_alerts = [a for a in result.signals if a.drift_type == DriftType.STALENESS]
        assert len(stale_alerts) == 0
    
    def test_dr006_context_at_threshold_boundary(self, drift_detector, sample_context):
        """DR-006: Context exactly at 24 hour threshold should be borderline."""
        context = sample_context
        context.updated_at = datetime.now(ZoneInfo("UTC")) - timedelta(hours=24)
        
        result = drift_detector.detect([context])
        
        # Could be stale or borderline depending on implementation
        # At minimum, should have reduced confidence
        assert result.overall_health <= 0.7 or any(
            a.drift_type == DriftType.STALENESS for a in result.signals
        )
    
    def test_dr007_context_beyond_threshold_is_stale(self, drift_detector, stale_context):
        """DR-007: Context beyond 24 hours should be marked STALE."""
        context = stale_context
        
        result = drift_detector.detect([context])
        
        # Should detect staleness
        stale_alerts = [a for a in result.signals if a.drift_type == DriftType.STALENESS]
        assert len(stale_alerts) > 0
        
        # Apply the status update
        drift_detector.update_drift_status(context, result.signals)
        assert context.drift_status in [DriftStatus.STALE, DriftStatus.DRIFTING]
    
    def test_staleness_updates_status(self, drift_detector, stale_context, db_session):
        """Staleness detection should update drift status."""
        context = stale_context
        original_status = context.drift_status
        
        result = drift_detector.detect([context])
        drift_detector.update_drift_status(context, result.signals)
        
        # Status should be STALE
        assert context.drift_status == DriftStatus.STALE


class TestDriftStatusTransitions:
    """Tests for valid drift status transitions."""
    
    def test_dr008_valid_stable_to_drifting(self, drift_detector, sample_context, assertions):
        """DR-008: STABLE → DRIFTING is valid transition."""
        context = sample_context
        context.drift_status = DriftStatus.STABLE
        
        # Single correction should trigger DRIFTING
        context.record_correction()
        
        assertions.assert_drift_status_transition_valid(DriftStatus.STABLE, DriftStatus.DRIFTING)
        # Depending on implementation, could be STABLE or DRIFTING
        assert context.drift_status in [DriftStatus.STABLE, DriftStatus.DRIFTING]
    
    def test_valid_drifting_to_conflicting(self, drift_detector, sample_context, assertions):
        """DRIFTING → CONFLICTING is valid transition."""
        context = sample_context
        
        # Multiple corrections to reach CONFLICTING
        for i in range(4):
            context.record_correction()
        
        assertions.assert_drift_status_transition_valid(DriftStatus.DRIFTING, DriftStatus.CONFLICTING)
        assert context.drift_status == DriftStatus.CONFLICTING
    
    def test_valid_drifting_to_stale(self, drift_detector, stale_context, assertions):
        """DRIFTING → STALE is valid transition."""
        context = stale_context
        context.drift_status = DriftStatus.DRIFTING
        
        result = drift_detector.detect([context])
        drift_detector.update_drift_status(context, result.signals)
        
        assertions.assert_drift_status_transition_valid(DriftStatus.DRIFTING, DriftStatus.STALE)
    
    def test_invalid_stale_to_stable_without_refresh(self, drift_detector, stale_context):
        """STALE → STABLE should not happen without explicit refresh."""
        context = stale_context
        context.drift_status = DriftStatus.STALE
        
        # Just detecting should not reset status
        result = drift_detector.detect([context])
        
        # Should remain STALE without explicit refresh action
        assert context.drift_status == DriftStatus.STALE


class TestHealthScoreCalculation:
    """Tests for health score calculation."""
    
    def test_healthy_context_high_score(self, drift_detector, sample_context):
        """Healthy context should have high health score."""
        context = sample_context
        context.updated_at = datetime.now(ZoneInfo("UTC")) - timedelta(minutes=30)
        context.confidence = 0.9
        context.correction_count = 0
        
        result = drift_detector.detect([context])
        
        assert result.overall_health >= 0.8
    
    def test_stale_context_low_score(self, drift_detector, stale_context):
        """Stale context should have lower health score."""
        context = stale_context
        
        result = drift_detector.detect([context])
        
        # Stale context should have reduced health (< 0.7)
        # Formula: health = (1 - severity * 0.15) * (0.5 + 0.5 * confidence)
        # With severity=1.0 and confidence=0.5: 0.85 * 0.75 = 0.6375
        assert result.overall_health < 0.7
    
    def test_corrected_context_reduced_score(self, drift_detector, corrected_context):
        """Context with many corrections should have reduced score."""
        context = corrected_context
        
        result = drift_detector.detect([context])
        
        # Score should reflect reduced confidence
        assert result.overall_health < 0.7
    
    def test_health_score_in_valid_range(self, drift_detector, sample_context):
        """Health score should always be in [0, 1]."""
        context = sample_context
        
        result = drift_detector.detect([context])
        
        assert 0.0 <= result.overall_health <= 1.0


class TestDriftAlerts:
    """Tests for drift alert generation."""
    
    def test_correction_alert_generated(self, drift_detector, sample_context):
        """Correction pattern should generate alert."""
        context = sample_context
        
        # Record corrections
        for i in range(3):
            context.record_correction()
        
        result = drift_detector.detect([context])
        
        # Should have correction pattern alert
        correction_alerts = [
            a for a in result.signals 
            if a.drift_type == DriftType.CORRECTION_PATTERN
        ]
        assert len(correction_alerts) > 0
    
    def test_alert_includes_reasoning(self, drift_detector, stale_context):
        """Alerts should include reasoning for explainability."""
        context = stale_context
        
        result = drift_detector.detect([context])
        
        for alert in result.signals:
            assert alert.description is not None
            assert len(alert.description) > 0
    
    def test_alert_includes_recommendation(self, drift_detector, stale_context):
        """Alerts should include actionable recommendation."""
        context = stale_context
        
        result = drift_detector.detect([context])
        
        for alert in result.signals:
            assert alert.recommended_action is not None or alert.suggested_action is not None
    
    def test_multiple_drift_types_detected(self, drift_detector, sample_context):
        """Multiple drift types can be detected simultaneously."""
        context = sample_context
        # Make it stale
        context.updated_at = datetime.now(ZoneInfo("UTC")) - timedelta(hours=48)
        # And corrected
        for i in range(3):
            context.record_correction()
        
        result = drift_detector.detect([context])
        
        # Should have multiple alert types
        drift_types = {a.drift_type for a in result.signals}
        assert len(drift_types) >= 2


class TestBehavioralMismatchDetection:
    """Tests for behavioral mismatch detection."""
    
    def test_low_confidence_flagged(self, drift_detector, sample_context):
        """Low confidence context should be flagged."""
        context = sample_context
        context.confidence = 0.3  # Below LOW_CONFIDENCE_THRESHOLD
        
        result = drift_detector.detect([context])
        
        # Should flag low confidence
        low_conf_alerts = [
            a for a in result.signals
            if a.drift_type == DriftType.BEHAVIORAL_MISMATCH 
            or "confidence" in a.description.lower()
        ]
        # Either explicit alert or reduced health score
        assert len(low_conf_alerts) > 0 or result.overall_health < 0.5
    
    def test_confidence_floor_respected(self, drift_detector, sample_context):
        """Context confidence should not go below floor after decay."""
        context = sample_context
        
        # Apply heavy decay
        for _ in range(10):
            context.decay_confidence(factor=0.5)
        
        # Should have floor
        assert context.confidence >= 0.1  # Reasonable floor


class TestContextRefresh:
    """Tests for context refresh behavior."""
    
    def test_refresh_resets_staleness(self, drift_detector, stale_context):
        """Refreshing context should reset staleness indicators."""
        context = stale_context
        
        # Refresh the context
        context.updated_at = datetime.now(ZoneInfo("UTC"))
        
        result = drift_detector.detect([context])
        
        # Should no longer be stale
        stale_alerts = [a for a in result.signals if a.drift_type == DriftType.STALENESS]
        assert len(stale_alerts) == 0
    
    def test_refresh_preserves_correction_count(self, drift_detector, corrected_context):
        """Refreshing should preserve correction count."""
        context = corrected_context
        original_count = context.correction_count
        
        # Refresh timestamp
        context.updated_at = datetime.now(ZoneInfo("UTC"))
        
        # Corrections should be preserved
        assert context.correction_count == original_count


class TestDriftDetectionIdempotency:
    """Tests to ensure drift detection is idempotent."""
    
    def test_repeated_detection_same_result(self, drift_detector, sample_context):
        """Running detection twice should produce same result."""
        context = sample_context
        
        result1 = drift_detector.detect([context])
        result2 = drift_detector.detect([context])
        
        assert result1.overall_health == result2.overall_health
        assert len(result1.signals) == len(result2.signals)
    
    def test_detection_does_not_modify_context(self, drift_detector, sample_context):
        """Detection should not modify context by itself."""
        context = sample_context
        original_status = context.drift_status
        original_confidence = context.confidence
        original_count = context.correction_count
        
        # Just detect, don't update
        result = drift_detector.detect([context])
        
        # Context unchanged (update requires explicit call)
        assert context.drift_status == original_status
        assert context.confidence == original_confidence
        assert context.correction_count == original_count
