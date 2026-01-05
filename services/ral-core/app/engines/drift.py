"""
Drift Detection Engine

Detects context staleness, conflicts, and drift patterns.
Ensures context reliability and triggers corrections.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Optional
from uuid import UUID

import structlog

from app.models.context import Context, ContextType, DriftStatus, MemoryTier

logger = structlog.get_logger()


class DriftType(str, Enum):
    """Types of context drift."""
    
    STALENESS = "staleness"        # Context is too old
    CONFLICT = "conflict"          # Conflicting values
    CORRECTION_PATTERN = "correction_pattern"  # User keeps correcting
    BEHAVIORAL_MISMATCH = "behavioral_mismatch"  # Usage doesn't match context


@dataclass
class DriftSignal:
    """A signal indicating potential drift."""
    
    drift_type: DriftType
    context_id: UUID
    context_key: str
    severity: float  # 0.0 - 1.0
    description: str
    detected_at: datetime
    recommended_action: str


@dataclass
class DriftReport:
    """Summary of drift detection for a user."""
    
    user_id: UUID
    signals: list[DriftSignal]
    overall_health: float  # 0.0 - 1.0 (1.0 = healthy)
    contexts_checked: int
    stale_count: int
    conflicting_count: int
    needs_attention: bool
    recommendations: list[str]


class DriftDetector:
    """
    Drift Detection Engine
    
    Responsible for:
    - Detecting stale context based on age and confidence decay
    - Identifying conflicting context values
    - Recognizing correction patterns (user keeps fixing)
    - Flagging behavioral mismatches
    
    Core principle: Never silently propagate unreliable context.
    """
    
    # Thresholds
    STALENESS_HOURS = 24  # Context older than this is potentially stale
    CRITICAL_STALENESS_HOURS = 72  # Context older than this is definitely stale
    CORRECTION_THRESHOLD = 3  # More than this many corrections = conflict
    LOW_CONFIDENCE_THRESHOLD = 0.4  # Below this = flagged
    CRITICAL_CONFIDENCE_THRESHOLD = 0.2  # Below this = definitely bad
    
    def __init__(
        self,
        staleness_hours: int = 24,
        correction_threshold: int = 3,
    ):
        """
        Initialize the Drift Detector.
        
        Args:
            staleness_hours: Hours after which context is considered stale
            correction_threshold: Corrections before flagging as conflicting
        """
        self.staleness_hours = staleness_hours
        self.correction_threshold = correction_threshold
        
        logger.info(
            "Drift detector initialized",
            staleness_hours=staleness_hours,
            correction_threshold=correction_threshold,
        )
    
    def detect(self, contexts: list[Context]) -> DriftReport:
        """
        Detect drift across all contexts for a user.
        
        Args:
            contexts: List of user's contexts to analyze
            
        Returns:
            Drift report with signals and recommendations
        """
        if not contexts:
            return DriftReport(
                user_id=UUID("00000000-0000-0000-0000-000000000000"),
                signals=[],
                overall_health=1.0,
                contexts_checked=0,
                stale_count=0,
                conflicting_count=0,
                needs_attention=False,
                recommendations=[],
            )
        
        user_id = contexts[0].user_id
        signals: list[DriftSignal] = []
        
        # Check each context
        for context in contexts:
            # Check staleness
            staleness_signal = self._check_staleness(context)
            if staleness_signal:
                signals.append(staleness_signal)
            
            # Check correction patterns
            correction_signal = self._check_corrections(context)
            if correction_signal:
                signals.append(correction_signal)
            
            # Check confidence
            confidence_signal = self._check_confidence(context)
            if confidence_signal:
                signals.append(confidence_signal)
        
        # Check for conflicts between contexts
        conflict_signals = self._check_conflicts(contexts)
        signals.extend(conflict_signals)
        
        # Calculate overall health
        health = self._calculate_health(contexts, signals)
        
        # Count issues
        stale_count = sum(1 for s in signals if s.drift_type == DriftType.STALENESS)
        conflict_count = sum(
            1 for s in signals 
            if s.drift_type in (DriftType.CONFLICT, DriftType.CORRECTION_PATTERN)
        )
        
        # Generate recommendations
        recommendations = self._generate_recommendations(signals, contexts)
        
        return DriftReport(
            user_id=user_id,
            signals=signals,
            overall_health=health,
            contexts_checked=len(contexts),
            stale_count=stale_count,
            conflicting_count=conflict_count,
            needs_attention=health < 0.7 or len(signals) > 0,
            recommendations=recommendations,
        )
    
    def check_single(self, context: Context) -> list[DriftSignal]:
        """
        Check a single context for drift.
        
        Args:
            context: Context to check
            
        Returns:
            List of drift signals (empty if healthy)
        """
        signals = []
        
        staleness = self._check_staleness(context)
        if staleness:
            signals.append(staleness)
        
        corrections = self._check_corrections(context)
        if corrections:
            signals.append(corrections)
        
        confidence = self._check_confidence(context)
        if confidence:
            signals.append(confidence)
        
        return signals
    
    def should_refresh(self, context: Context) -> tuple[bool, str]:
        """
        Determine if a context should be refreshed.
        
        Args:
            context: Context to evaluate
            
        Returns:
            Tuple of (should_refresh, reason)
        """
        now = datetime.now(timezone.utc)
        age_hours = (now - context.updated_at).total_seconds() / 3600
        
        # Definitely refresh if expired
        if context.is_expired:
            return True, "Context has expired"
        
        # Definitely refresh if critically stale
        if age_hours > self.CRITICAL_STALENESS_HOURS:
            return True, f"Context is {int(age_hours)} hours old (critical)"
        
        # Refresh if drift status is bad
        if context.drift_status == DriftStatus.CONFLICTING:
            return True, "Context has conflicting status"
        
        # Refresh if confidence is too low
        if context.confidence < self.CRITICAL_CONFIDENCE_THRESHOLD:
            return True, f"Confidence too low ({context.confidence:.2f})"
        
        # Consider refreshing if stale
        if age_hours > self.staleness_hours and context.confidence < 0.7:
            return True, f"Context is stale ({int(age_hours)}h) with moderate confidence"
        
        # No refresh needed
        return False, "Context is healthy"
    
    def suggest_resolution(self, signal: DriftSignal) -> dict[str, Any]:
        """
        Suggest how to resolve a drift signal.
        
        Args:
            signal: The drift signal to resolve
            
        Returns:
            Resolution suggestion with steps
        """
        if signal.drift_type == DriftType.STALENESS:
            return {
                "action": "refresh",
                "description": "Request updated context from user or re-infer from recent activity",
                "automatic": signal.severity < 0.7,
                "user_prompt": f"Your {signal.context_key} information might be outdated. Would you like to update it?",
            }
        
        if signal.drift_type == DriftType.CORRECTION_PATTERN:
            return {
                "action": "confirm",
                "description": "Ask user to confirm the correct value",
                "automatic": False,
                "user_prompt": f"I've noticed some uncertainty about your {signal.context_key}. Can you confirm the current value?",
            }
        
        if signal.drift_type == DriftType.CONFLICT:
            return {
                "action": "resolve_conflict",
                "description": "Present conflicting values to user for resolution",
                "automatic": False,
                "user_prompt": f"I found conflicting information about your {signal.context_key}. Which is correct?",
            }
        
        if signal.drift_type == DriftType.BEHAVIORAL_MISMATCH:
            return {
                "action": "investigate",
                "description": "Analyze recent interactions to understand mismatch",
                "automatic": True,
                "user_prompt": None,
            }
        
        return {
            "action": "monitor",
            "description": "Continue monitoring for further signals",
            "automatic": True,
            "user_prompt": None,
        }
    
    def _check_staleness(self, context: Context) -> Optional[DriftSignal]:
        """Check if context is stale based on age."""
        
        # Long-term memory has different staleness rules
        if context.memory_tier == MemoryTier.LONG_TERM:
            staleness_hours = self.CRITICAL_STALENESS_HOURS * 7  # Weekly check
        else:
            staleness_hours = self.staleness_hours
        
        now = datetime.now(timezone.utc)
        # Handle both timezone-aware and timezone-naive datetimes
        updated_at = context.updated_at
        if updated_at.tzinfo is None:
            updated_at = updated_at.replace(tzinfo=timezone.utc)
        age_hours = (now - updated_at).total_seconds() / 3600
        
        if age_hours < staleness_hours:
            return None
        
        # Calculate severity based on how far past threshold
        severity = min(1.0, (age_hours - staleness_hours) / staleness_hours)
        
        return DriftSignal(
            drift_type=DriftType.STALENESS,
            context_id=context.id,
            context_key=context.key,
            severity=severity,
            description=f"Context is {int(age_hours)} hours old (threshold: {staleness_hours}h)",
            detected_at=now,
            recommended_action="refresh" if severity > 0.5 else "monitor",
        )
    
    def _check_corrections(self, context: Context) -> Optional[DriftSignal]:
        """Check if context has too many corrections."""
        
        if context.correction_count < self.correction_threshold:
            return None
        
        severity = min(1.0, context.correction_count / (self.correction_threshold * 2))
        
        return DriftSignal(
            drift_type=DriftType.CORRECTION_PATTERN,
            context_id=context.id,
            context_key=context.key,
            severity=severity,
            description=f"Context has been corrected {context.correction_count} times",
            detected_at=datetime.now(timezone.utc),
            recommended_action="confirm_with_user",
        )
    
    def _check_confidence(self, context: Context) -> Optional[DriftSignal]:
        """Check if confidence is too low."""
        
        if context.confidence >= self.LOW_CONFIDENCE_THRESHOLD:
            return None
        
        severity = 1.0 - (context.confidence / self.LOW_CONFIDENCE_THRESHOLD)
        
        return DriftSignal(
            drift_type=DriftType.STALENESS,  # Low confidence often means staleness
            context_id=context.id,
            context_key=context.key,
            severity=severity,
            description=f"Confidence is low ({context.confidence:.2f})",
            detected_at=datetime.now(timezone.utc),
            recommended_action="refresh" if context.confidence < self.CRITICAL_CONFIDENCE_THRESHOLD else "monitor",
        )
    
    def _check_conflicts(self, contexts: list[Context]) -> list[DriftSignal]:
        """Check for conflicts between related contexts."""
        
        signals = []
        
        # Group by type
        by_type: dict[ContextType, list[Context]] = {}
        for ctx in contexts:
            if ctx.context_type not in by_type:
                by_type[ctx.context_type] = []
            by_type[ctx.context_type].append(ctx)
        
        # Check temporal conflicts
        temporal = by_type.get(ContextType.TEMPORAL, [])
        if len(temporal) > 1:
            # Check for timezone conflicts
            timezones = set()
            for ctx in temporal:
                if ctx.key == "timezone":
                    tz = ctx.value.get("timezone")
                    if tz:
                        timezones.add(tz)
            
            if len(timezones) > 1:
                signals.append(DriftSignal(
                    drift_type=DriftType.CONFLICT,
                    context_id=temporal[0].id,
                    context_key="timezone",
                    severity=0.8,
                    description=f"Multiple timezones detected: {timezones}",
                    detected_at=datetime.now(timezone.utc),
                    recommended_action="resolve_conflict",
                ))
        
        # Check spatial conflicts
        spatial = by_type.get(ContextType.SPATIAL, [])
        if len(spatial) > 1:
            countries = set()
            for ctx in spatial:
                country = ctx.value.get("country_code")
                if country:
                    countries.add(country)
            
            if len(countries) > 1:
                signals.append(DriftSignal(
                    drift_type=DriftType.CONFLICT,
                    context_id=spatial[0].id,
                    context_key="country",
                    severity=0.7,
                    description=f"Multiple countries detected: {countries}",
                    detected_at=datetime.now(timezone.utc),
                    recommended_action="resolve_conflict",
                ))
        
        return signals
    
    def _calculate_health(
        self,
        contexts: list[Context],
        signals: list[DriftSignal],
    ) -> float:
        """Calculate overall context health score."""
        
        if not contexts:
            return 1.0
        
        # Start with perfect health
        health = 1.0
        
        # Deduct for each signal based on severity
        for signal in signals:
            if signal.drift_type == DriftType.CONFLICT:
                health -= signal.severity * 0.3
            elif signal.drift_type == DriftType.CORRECTION_PATTERN:
                health -= signal.severity * 0.2
            elif signal.drift_type == DriftType.STALENESS:
                health -= signal.severity * 0.15
            else:
                health -= signal.severity * 0.1
        
        # Also factor in average confidence
        avg_confidence = sum(c.confidence for c in contexts) / len(contexts)
        health = health * (0.5 + 0.5 * avg_confidence)
        
        return max(0.0, min(1.0, health))
    
    def _generate_recommendations(
        self,
        signals: list[DriftSignal],
        contexts: list[Context],
    ) -> list[str]:
        """Generate human-readable recommendations."""
        
        recommendations = []
        
        # Group signals by type
        conflicts = [s for s in signals if s.drift_type == DriftType.CONFLICT]
        stale = [s for s in signals if s.drift_type == DriftType.STALENESS]
        corrections = [s for s in signals if s.drift_type == DriftType.CORRECTION_PATTERN]
        
        if conflicts:
            keys = set(s.context_key for s in conflicts)
            recommendations.append(
                f"Resolve conflicting values for: {', '.join(keys)}"
            )
        
        if corrections:
            keys = set(s.context_key for s in corrections)
            recommendations.append(
                f"Confirm correct values for frequently corrected: {', '.join(keys)}"
            )
        
        if stale:
            count = len(stale)
            recommendations.append(
                f"Refresh {count} stale context{'s' if count > 1 else ''}"
            )
        
        # Check for low overall confidence
        low_confidence = [c for c in contexts if c.confidence < 0.5]
        if len(low_confidence) > len(contexts) * 0.3:
            recommendations.append(
                "Consider requesting updated context from user - many values have low confidence"
            )
        
        if not recommendations:
            recommendations.append("No issues detected - context is healthy")
        
        return recommendations
    
    def update_drift_status(
        self,
        context: Context,
        signals: list[DriftSignal],
    ) -> DriftStatus:
        """
        Determine and update the drift status based on signals.
        
        Args:
            context: The context to evaluate (will be mutated)
            signals: Drift signals for this context
            
        Returns:
            The new drift status
        """
        new_status: DriftStatus
        
        if not signals:
            new_status = DriftStatus.STABLE
        elif any(s.drift_type == DriftType.CONFLICT for s in signals):
            # Conflicts are most severe
            new_status = DriftStatus.CONFLICTING
        elif any(s.drift_type == DriftType.CORRECTION_PATTERN for s in signals):
            # Correction patterns also indicate conflicting state
            new_status = DriftStatus.CONFLICTING
        else:
            # Check for staleness
            stale_signals = [s for s in signals if s.drift_type == DriftType.STALENESS]
            if stale_signals:
                max_severity = max(s.severity for s in stale_signals)
                if max_severity > 0.7:
                    new_status = DriftStatus.STALE
                else:
                    new_status = DriftStatus.DRIFTING
            else:
                # Minor drift
                new_status = DriftStatus.DRIFTING
        
        # Actually update the context's drift_status
        context.drift_status = new_status
        return new_status
