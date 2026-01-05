"""
Contextual Decay & TTL Management

Implements:
- Per-context-type TTL (spatial: 30min, temporal: 1min, situational: session-based)
- Conflict overwrite rules (explicit user input > sensor data)
- Automatic decay and cleanup
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Callable, Optional
import asyncio

import structlog

from app.core.config import settings
from app.models.context import ContextType, MemoryTier

logger = structlog.get_logger()


class ConflictResolution(str, Enum):
    """Conflict resolution strategies."""
    USER_WINS = "user_wins"             # User input always wins
    SENSOR_WINS = "sensor_wins"         # Sensor data always wins
    NEWER_WINS = "newer_wins"           # Most recent wins
    CONFIDENCE_WINS = "confidence_wins" # Highest confidence wins
    MERGE = "merge"                     # Merge both values


class ContextSource(str, Enum):
    """Sources of context data."""
    USER_EXPLICIT = "user_explicit"     # Direct user input
    USER_IMPLICIT = "user_implicit"     # Inferred from user behavior
    SENSOR = "sensor"                   # Device sensors
    API = "api"                         # External API
    INFERENCE = "inference"             # System inference
    HISTORICAL = "historical"           # From history


@dataclass
class TTLConfig:
    """TTL configuration for a context type."""
    context_type: ContextType
    default_ttl_seconds: int
    min_ttl_seconds: int = 60
    max_ttl_seconds: int = 86400        # 24 hours
    decay_curve: str = "linear"         # linear, exponential, step
    refresh_on_access: bool = False     # Extend TTL on read
    refresh_amount_seconds: int = 0     # How much to extend
    
    def get_ttl(self, confidence: float = 1.0) -> int:
        """Get TTL adjusted by confidence."""
        # Higher confidence = longer TTL
        adjusted = int(self.default_ttl_seconds * confidence)
        return max(self.min_ttl_seconds, min(adjusted, self.max_ttl_seconds))


@dataclass
class DecaySchedule:
    """Decay schedule for context confidence."""
    initial_confidence: float = 1.0
    decay_rate_per_hour: float = 0.1    # Linear decay
    min_confidence: float = 0.1
    
    def calculate_confidence(
        self,
        hours_elapsed: float,
        curve: str = "linear",
    ) -> float:
        """Calculate confidence after time elapsed."""
        if curve == "exponential":
            # Exponential decay
            import math
            confidence = self.initial_confidence * math.exp(
                -self.decay_rate_per_hour * hours_elapsed
            )
        elif curve == "step":
            # Step decay (drops at specific intervals)
            steps = int(hours_elapsed / 6)  # Every 6 hours
            confidence = self.initial_confidence * (0.7 ** steps)
        else:
            # Linear decay
            confidence = self.initial_confidence - (
                self.decay_rate_per_hour * hours_elapsed
            )
        
        return max(self.min_confidence, min(1.0, confidence))


@dataclass
class ContextEntry:
    """Enhanced context entry with TTL and decay metadata."""
    key: str
    value: Any
    context_type: ContextType
    source: ContextSource
    confidence: float = 1.0
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    accessed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
    session_id: Optional[str] = None
    user_id: str = ""
    access_count: int = 0
    correction_count: int = 0
    
    @property
    def is_expired(self) -> bool:
        """Check if entry has expired."""
        if self.expires_at is None:
            return False
        return datetime.now(timezone.utc) > self.expires_at
    
    @property
    def age_seconds(self) -> float:
        """Get age of entry in seconds."""
        now = datetime.now(timezone.utc)
        return (now - self.created_at).total_seconds()
    
    @property
    def age_hours(self) -> float:
        """Get age of entry in hours."""
        return self.age_seconds / 3600
    
    def refresh_ttl(self, additional_seconds: int) -> None:
        """Extend TTL by additional seconds."""
        if self.expires_at:
            self.expires_at = self.expires_at + timedelta(seconds=additional_seconds)
    
    def record_access(self) -> None:
        """Record an access to this entry."""
        self.accessed_at = datetime.now(timezone.utc)
        self.access_count += 1
    
    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "value": self.value,
            "context_type": self.context_type.value,
            "source": self.source.value,
            "confidence": self.confidence,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "accessed_at": self.accessed_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "access_count": self.access_count,
            "correction_count": self.correction_count,
            "is_expired": self.is_expired,
            "age_seconds": self.age_seconds,
        }


@dataclass
class ConflictResult:
    """Result of conflict resolution."""
    winning_value: Any
    winning_source: ContextSource
    resolution_method: ConflictResolution
    merged: bool = False
    explanation: str = ""


class ContextualDecayManager:
    """
    Manager for contextual decay and TTL.
    
    Handles:
    - Per-type TTL configuration
    - Automatic decay of confidence
    - Conflict resolution between sources
    - Session-based context management
    """
    
    # Default TTL configurations per context type
    DEFAULT_TTLS: dict[ContextType, TTLConfig] = {
        ContextType.TEMPORAL: TTLConfig(
            context_type=ContextType.TEMPORAL,
            default_ttl_seconds=60,          # 1 minute
            min_ttl_seconds=30,
            max_ttl_seconds=300,             # 5 minutes max
            decay_curve="step",
            refresh_on_access=False,
        ),
        ContextType.SPATIAL: TTLConfig(
            context_type=ContextType.SPATIAL,
            default_ttl_seconds=1800,        # 30 minutes
            min_ttl_seconds=300,             # 5 minutes min
            max_ttl_seconds=7200,            # 2 hours max
            decay_curve="linear",
            refresh_on_access=True,
            refresh_amount_seconds=300,      # Add 5 min on access
        ),
        ContextType.SITUATIONAL: TTLConfig(
            context_type=ContextType.SITUATIONAL,
            default_ttl_seconds=0,           # Session-based (no fixed TTL)
            min_ttl_seconds=0,
            max_ttl_seconds=0,
            decay_curve="linear",
            refresh_on_access=True,
        ),
        ContextType.META: TTLConfig(
            context_type=ContextType.META,
            default_ttl_seconds=86400,       # 24 hours
            min_ttl_seconds=3600,
            max_ttl_seconds=604800,          # 7 days
            decay_curve="exponential",
            refresh_on_access=True,
            refresh_amount_seconds=3600,
        ),
    }
    
    # Conflict resolution priority by source
    SOURCE_PRIORITY = {
        ContextSource.USER_EXPLICIT: 100,
        ContextSource.USER_IMPLICIT: 80,
        ContextSource.API: 60,
        ContextSource.SENSOR: 50,
        ContextSource.INFERENCE: 40,
        ContextSource.HISTORICAL: 20,
    }
    
    def __init__(
        self,
        ttl_configs: Optional[dict[ContextType, TTLConfig]] = None,
        default_resolution: ConflictResolution = ConflictResolution.USER_WINS,
    ):
        """
        Initialize the decay manager.
        
        Args:
            ttl_configs: Custom TTL configurations
            default_resolution: Default conflict resolution strategy
        """
        self.ttl_configs = ttl_configs or self.DEFAULT_TTLS
        self.default_resolution = default_resolution
        self._decay_schedule = DecaySchedule()
        
        # Active entries by user_id
        self._entries: dict[str, dict[str, ContextEntry]] = {}
        
        # Session tracking
        self._active_sessions: dict[str, datetime] = {}
    
    def get_ttl_config(self, context_type: ContextType) -> TTLConfig:
        """Get TTL config for a context type."""
        return self.ttl_configs.get(context_type, self.DEFAULT_TTLS[ContextType.META])
    
    def calculate_expiry(
        self,
        context_type: ContextType,
        confidence: float = 1.0,
        session_id: Optional[str] = None,
    ) -> Optional[datetime]:
        """
        Calculate expiry time for context.
        
        Args:
            context_type: Type of context
            confidence: Confidence level (affects TTL)
            session_id: Session ID for session-based context
            
        Returns:
            Expiry datetime, or None for session-based
        """
        config = self.get_ttl_config(context_type)
        
        # Session-based (situational) context
        if config.default_ttl_seconds == 0:
            return None  # Expires with session
        
        ttl_seconds = config.get_ttl(confidence)
        return datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
    
    def create_entry(
        self,
        user_id: str,
        key: str,
        value: Any,
        context_type: ContextType,
        source: ContextSource,
        confidence: float = 1.0,
        session_id: Optional[str] = None,
    ) -> ContextEntry:
        """
        Create a new context entry with appropriate TTL.
        
        Args:
            user_id: User identifier
            key: Context key
            value: Context value
            context_type: Type of context
            source: Source of context
            confidence: Confidence level
            session_id: Session ID for session-based context
            
        Returns:
            New context entry
        """
        now = datetime.now(timezone.utc)
        expires_at = self.calculate_expiry(context_type, confidence, session_id)
        
        entry = ContextEntry(
            key=key,
            value=value,
            context_type=context_type,
            source=source,
            confidence=confidence,
            created_at=now,
            updated_at=now,
            accessed_at=now,
            expires_at=expires_at,
            session_id=session_id,
            user_id=user_id,
        )
        
        # Store entry
        if user_id not in self._entries:
            self._entries[user_id] = {}
        
        entry_key = f"{context_type.value}:{key}"
        
        # Check for conflict with existing entry
        if entry_key in self._entries[user_id]:
            existing = self._entries[user_id][entry_key]
            if not existing.is_expired:
                resolution = self.resolve_conflict(existing, entry)
                entry.value = resolution.winning_value
                entry.source = resolution.winning_source
                entry.confidence = max(existing.confidence, entry.confidence)
                
                logger.debug(
                    "Context conflict resolved",
                    key=key,
                    resolution=resolution.resolution_method.value,
                    explanation=resolution.explanation,
                )
        
        self._entries[user_id][entry_key] = entry
        
        logger.debug(
            "Context entry created",
            user_id=user_id,
            key=key,
            context_type=context_type.value,
            ttl_seconds=(expires_at - now).total_seconds() if expires_at else "session",
        )
        
        return entry
    
    def get_entry(
        self,
        user_id: str,
        key: str,
        context_type: ContextType,
    ) -> Optional[ContextEntry]:
        """
        Get a context entry, applying decay and TTL checks.
        
        Args:
            user_id: User identifier
            key: Context key
            context_type: Type of context
            
        Returns:
            Context entry if valid, None if expired or not found
        """
        entry_key = f"{context_type.value}:{key}"
        
        if user_id not in self._entries:
            return None
        
        entry = self._entries[user_id].get(entry_key)
        if not entry:
            return None
        
        # Check expiry
        if entry.is_expired:
            del self._entries[user_id][entry_key]
            logger.debug(
                "Context entry expired",
                user_id=user_id,
                key=key,
            )
            return None
        
        # Apply decay
        entry.confidence = self._decay_schedule.calculate_confidence(
            entry.age_hours,
            self.get_ttl_config(context_type).decay_curve,
        )
        
        # Record access
        entry.record_access()
        
        # Refresh TTL if configured
        config = self.get_ttl_config(context_type)
        if config.refresh_on_access and config.refresh_amount_seconds > 0:
            entry.refresh_ttl(config.refresh_amount_seconds)
        
        return entry
    
    def resolve_conflict(
        self,
        existing: ContextEntry,
        incoming: ContextEntry,
        strategy: Optional[ConflictResolution] = None,
    ) -> ConflictResult:
        """
        Resolve conflict between existing and incoming context.
        
        Args:
            existing: Existing context entry
            incoming: Incoming context entry
            strategy: Resolution strategy (uses default if None)
            
        Returns:
            Conflict resolution result
        """
        strategy = strategy or self.default_resolution
        
        if strategy == ConflictResolution.USER_WINS:
            # User explicit input always wins
            if incoming.source == ContextSource.USER_EXPLICIT:
                return ConflictResult(
                    winning_value=incoming.value,
                    winning_source=incoming.source,
                    resolution_method=strategy,
                    explanation="User explicit input takes priority",
                )
            elif existing.source == ContextSource.USER_EXPLICIT:
                return ConflictResult(
                    winning_value=existing.value,
                    winning_source=existing.source,
                    resolution_method=strategy,
                    explanation="Existing user explicit input preserved",
                )
            # Fall through to priority-based
        
        if strategy == ConflictResolution.SENSOR_WINS:
            # Sensor data wins
            if incoming.source == ContextSource.SENSOR:
                return ConflictResult(
                    winning_value=incoming.value,
                    winning_source=incoming.source,
                    resolution_method=strategy,
                    explanation="Sensor data takes priority",
                )
        
        if strategy == ConflictResolution.NEWER_WINS:
            # Most recent wins
            if incoming.created_at > existing.created_at:
                return ConflictResult(
                    winning_value=incoming.value,
                    winning_source=incoming.source,
                    resolution_method=strategy,
                    explanation="Newer entry wins",
                )
            return ConflictResult(
                winning_value=existing.value,
                winning_source=existing.source,
                resolution_method=strategy,
                explanation="Existing entry is newer",
            )
        
        if strategy == ConflictResolution.CONFIDENCE_WINS:
            # Highest confidence wins
            if incoming.confidence > existing.confidence:
                return ConflictResult(
                    winning_value=incoming.value,
                    winning_source=incoming.source,
                    resolution_method=strategy,
                    explanation=f"Higher confidence ({incoming.confidence:.2f} > {existing.confidence:.2f})",
                )
            return ConflictResult(
                winning_value=existing.value,
                winning_source=existing.source,
                resolution_method=strategy,
                explanation=f"Existing has higher confidence ({existing.confidence:.2f})",
            )
        
        if strategy == ConflictResolution.MERGE:
            # Merge values
            merged = self._merge_values(existing.value, incoming.value)
            return ConflictResult(
                winning_value=merged,
                winning_source=incoming.source,
                resolution_method=strategy,
                merged=True,
                explanation="Values merged",
            )
        
        # Default: use source priority
        existing_priority = self.SOURCE_PRIORITY.get(existing.source, 0)
        incoming_priority = self.SOURCE_PRIORITY.get(incoming.source, 0)
        
        if incoming_priority > existing_priority:
            return ConflictResult(
                winning_value=incoming.value,
                winning_source=incoming.source,
                resolution_method=ConflictResolution.USER_WINS,
                explanation=f"Higher priority source ({incoming.source.value})",
            )
        
        return ConflictResult(
            winning_value=existing.value,
            winning_source=existing.source,
            resolution_method=ConflictResolution.USER_WINS,
            explanation=f"Existing source has priority ({existing.source.value})",
        )
    
    def _merge_values(self, existing: Any, incoming: Any) -> Any:
        """Merge two context values."""
        if isinstance(existing, dict) and isinstance(incoming, dict):
            # Deep merge dictionaries
            merged = existing.copy()
            for key, value in incoming.items():
                if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
                    merged[key] = self._merge_values(merged[key], value)
                else:
                    merged[key] = value
            return merged
        elif isinstance(existing, list) and isinstance(incoming, list):
            # Combine lists (unique values)
            combined = existing.copy()
            for item in incoming:
                if item not in combined:
                    combined.append(item)
            return combined
        else:
            # Incoming wins for scalar values
            return incoming
    
    def start_session(self, user_id: str, session_id: str) -> None:
        """Start a new session."""
        self._active_sessions[f"{user_id}:{session_id}"] = datetime.now(timezone.utc)
        logger.info("Session started", user_id=user_id, session_id=session_id)
    
    def end_session(self, user_id: str, session_id: str) -> int:
        """
        End a session and expire session-based context.
        
        Returns:
            Number of entries expired
        """
        session_key = f"{user_id}:{session_id}"
        if session_key in self._active_sessions:
            del self._active_sessions[session_key]
        
        # Expire all session-based entries
        expired_count = 0
        if user_id in self._entries:
            entries_to_remove = []
            for entry_key, entry in self._entries[user_id].items():
                if entry.session_id == session_id and entry.expires_at is None:
                    entries_to_remove.append(entry_key)
            
            for entry_key in entries_to_remove:
                del self._entries[user_id][entry_key]
                expired_count += 1
        
        logger.info(
            "Session ended",
            user_id=user_id,
            session_id=session_id,
            expired_entries=expired_count,
        )
        
        return expired_count
    
    def cleanup_expired(self, user_id: Optional[str] = None) -> int:
        """
        Clean up expired entries.
        
        Args:
            user_id: Optional user to clean up (all if None)
            
        Returns:
            Number of entries removed
        """
        removed = 0
        users = [user_id] if user_id else list(self._entries.keys())
        
        for uid in users:
            if uid not in self._entries:
                continue
            
            entries_to_remove = []
            for entry_key, entry in self._entries[uid].items():
                if entry.is_expired:
                    entries_to_remove.append(entry_key)
            
            for entry_key in entries_to_remove:
                del self._entries[uid][entry_key]
                removed += 1
        
        if removed > 0:
            logger.info("Expired entries cleaned up", count=removed)
        
        return removed
    
    def get_user_entries(
        self,
        user_id: str,
        context_type: Optional[ContextType] = None,
        include_expired: bool = False,
    ) -> list[ContextEntry]:
        """
        Get all entries for a user.
        
        Args:
            user_id: User identifier
            context_type: Filter by context type
            include_expired: Include expired entries
            
        Returns:
            List of context entries
        """
        if user_id not in self._entries:
            return []
        
        entries = []
        for entry in self._entries[user_id].values():
            if context_type and entry.context_type != context_type:
                continue
            if not include_expired and entry.is_expired:
                continue
            entries.append(entry)
        
        return entries
    
    def get_decay_stats(self, user_id: str) -> dict:
        """Get decay statistics for a user."""
        entries = self.get_user_entries(user_id)
        
        stats = {
            "total_entries": len(entries),
            "by_type": {},
            "by_source": {},
            "avg_confidence": 0.0,
            "avg_age_hours": 0.0,
            "expired_count": 0,
        }
        
        if not entries:
            return stats
        
        total_confidence = 0.0
        total_age = 0.0
        
        for entry in entries:
            # By type
            type_key = entry.context_type.value
            if type_key not in stats["by_type"]:
                stats["by_type"][type_key] = 0
            stats["by_type"][type_key] += 1
            
            # By source
            source_key = entry.source.value
            if source_key not in stats["by_source"]:
                stats["by_source"][source_key] = 0
            stats["by_source"][source_key] += 1
            
            total_confidence += entry.confidence
            total_age += entry.age_hours
        
        stats["avg_confidence"] = total_confidence / len(entries)
        stats["avg_age_hours"] = total_age / len(entries)
        
        # Count expired
        expired = self.get_user_entries(user_id, include_expired=True)
        stats["expired_count"] = len(expired) - len(entries)
        
        return stats


# Global instance
decay_manager = ContextualDecayManager()


async def periodic_cleanup(interval_seconds: int = 300):
    """Background task for periodic cleanup of expired entries."""
    while True:
        await asyncio.sleep(interval_seconds)
        removed = decay_manager.cleanup_expired()
        if removed > 0:
            logger.info("Periodic cleanup completed", removed=removed)
