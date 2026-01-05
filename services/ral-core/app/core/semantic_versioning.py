"""
Semantic Versioning of Reality

Implements:
- Context snapshotting on major shifts
- Version history with semantic versioning
- Restoration API for "time travel"
- Diff detection between versions
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
import copy
import hashlib
import json
import uuid

import structlog

from app.models.context import ContextType, DriftStatus

logger = structlog.get_logger()


class VersionType(str, Enum):
    """Types of version changes (semantic versioning)."""
    MAJOR = "major"     # Breaking change in context (location change, identity shift)
    MINOR = "minor"     # Significant addition (new context acquired)
    PATCH = "patch"     # Small update (confidence adjustment, refresh)


class ShiftTrigger(str, Enum):
    """Triggers for context shifts."""
    LOCATION_CHANGE = "location_change"
    TIME_TRANSITION = "time_transition"     # e.g., day->night, weekday->weekend
    ACTIVITY_CHANGE = "activity_change"
    SESSION_START = "session_start"
    SESSION_END = "session_end"
    USER_CORRECTION = "user_correction"
    DRIFT_DETECTED = "drift_detected"
    CONFLICT_RESOLVED = "conflict_resolved"
    MANUAL_SNAPSHOT = "manual_snapshot"
    SCHEDULED = "scheduled"


@dataclass
class SemanticVersion:
    """Semantic version representation."""
    major: int = 1
    minor: int = 0
    patch: int = 0
    
    def __str__(self) -> str:
        return f"{self.major}.{self.minor}.{self.patch}"
    
    def bump(self, version_type: VersionType) -> "SemanticVersion":
        """Create a new bumped version."""
        if version_type == VersionType.MAJOR:
            return SemanticVersion(self.major + 1, 0, 0)
        elif version_type == VersionType.MINOR:
            return SemanticVersion(self.major, self.minor + 1, 0)
        else:
            return SemanticVersion(self.major, self.minor, self.patch + 1)
    
    @classmethod
    def parse(cls, version_str: str) -> "SemanticVersion":
        """Parse version from string."""
        parts = version_str.split(".")
        return cls(
            major=int(parts[0]) if len(parts) > 0 else 1,
            minor=int(parts[1]) if len(parts) > 1 else 0,
            patch=int(parts[2]) if len(parts) > 2 else 0,
        )
    
    def to_dict(self) -> dict:
        return {"major": self.major, "minor": self.minor, "patch": self.patch}


@dataclass
class ContextDiff:
    """Diff between two context snapshots."""
    added_keys: list[str] = field(default_factory=list)
    removed_keys: list[str] = field(default_factory=list)
    modified_keys: list[str] = field(default_factory=list)
    changes: dict[str, dict] = field(default_factory=dict)  # key -> {old, new}
    
    @property
    def is_empty(self) -> bool:
        """Check if diff is empty (no changes)."""
        return not (self.added_keys or self.removed_keys or self.modified_keys)
    
    @property
    def change_count(self) -> int:
        """Total number of changes."""
        return len(self.added_keys) + len(self.removed_keys) + len(self.modified_keys)
    
    def to_dict(self) -> dict:
        return {
            "added_keys": self.added_keys,
            "removed_keys": self.removed_keys,
            "modified_keys": self.modified_keys,
            "changes": self.changes,
            "change_count": self.change_count,
        }


@dataclass
class ContextSnapshot:
    """
    Immutable snapshot of context state at a point in time.
    """
    snapshot_id: str
    user_id: str
    version: SemanticVersion
    timestamp: datetime
    trigger: ShiftTrigger
    
    # Context data by type
    temporal_context: dict = field(default_factory=dict)
    spatial_context: dict = field(default_factory=dict)
    situational_context: dict = field(default_factory=dict)
    meta_context: dict = field(default_factory=dict)
    
    # Metadata
    session_id: Optional[str] = None
    parent_snapshot_id: Optional[str] = None
    description: str = ""
    tags: list[str] = field(default_factory=list)
    checksum: str = ""
    
    def __post_init__(self):
        """Calculate checksum if not provided."""
        if not self.checksum:
            self.checksum = self._calculate_checksum()
    
    def _calculate_checksum(self) -> str:
        """Calculate checksum of context data."""
        data = {
            "temporal": self.temporal_context,
            "spatial": self.spatial_context,
            "situational": self.situational_context,
            "meta": self.meta_context,
        }
        json_str = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(json_str.encode()).hexdigest()[:16]
    
    def get_context(self, context_type: ContextType) -> dict:
        """Get context by type."""
        if context_type == ContextType.TEMPORAL:
            return self.temporal_context
        elif context_type == ContextType.SPATIAL:
            return self.spatial_context
        elif context_type == ContextType.SITUATIONAL:
            return self.situational_context
        else:
            return self.meta_context
    
    def get_all_context(self) -> dict:
        """Get all context as single dict."""
        return {
            "temporal": self.temporal_context,
            "spatial": self.spatial_context,
            "situational": self.situational_context,
            "meta": self.meta_context,
        }
    
    def to_dict(self) -> dict:
        return {
            "snapshot_id": self.snapshot_id,
            "user_id": self.user_id,
            "version": str(self.version),
            "timestamp": self.timestamp.isoformat(),
            "trigger": self.trigger.value,
            "temporal_context": self.temporal_context,
            "spatial_context": self.spatial_context,
            "situational_context": self.situational_context,
            "meta_context": self.meta_context,
            "session_id": self.session_id,
            "parent_snapshot_id": self.parent_snapshot_id,
            "description": self.description,
            "tags": self.tags,
            "checksum": self.checksum,
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "ContextSnapshot":
        """Create from dictionary."""
        return cls(
            snapshot_id=data["snapshot_id"],
            user_id=data["user_id"],
            version=SemanticVersion.parse(data["version"]),
            timestamp=datetime.fromisoformat(data["timestamp"]),
            trigger=ShiftTrigger(data["trigger"]),
            temporal_context=data.get("temporal_context", {}),
            spatial_context=data.get("spatial_context", {}),
            situational_context=data.get("situational_context", {}),
            meta_context=data.get("meta_context", {}),
            session_id=data.get("session_id"),
            parent_snapshot_id=data.get("parent_snapshot_id"),
            description=data.get("description", ""),
            tags=data.get("tags", []),
            checksum=data.get("checksum", ""),
        )


@dataclass
class RestorationResult:
    """Result of a context restoration operation."""
    success: bool
    restored_snapshot: Optional[ContextSnapshot]
    new_snapshot: Optional[ContextSnapshot]  # Snapshot created after restoration
    diff_from_current: ContextDiff
    message: str = ""
    
    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "restored_version": str(self.restored_snapshot.version) if self.restored_snapshot else None,
            "new_version": str(self.new_snapshot.version) if self.new_snapshot else None,
            "changes_applied": self.diff_from_current.change_count,
            "message": self.message,
        }


class ShiftDetector:
    """
    Detects major context shifts that warrant a new version.
    """
    
    # Thresholds for detecting shifts
    LOCATION_DISTANCE_KM_THRESHOLD = 5.0     # 5km = major location change
    TIME_TRANSITION_HOURS = 6                # 6 hour gap = time transition
    CONFIDENCE_DROP_THRESHOLD = 0.3          # 30% confidence drop
    
    def __init__(self):
        """Initialize the shift detector."""
        pass
    
    def detect_shift(
        self,
        current: ContextSnapshot,
        new_context: dict,
    ) -> tuple[bool, VersionType, ShiftTrigger]:
        """
        Detect if new context represents a significant shift.
        
        Args:
            current: Current snapshot
            new_context: New context data
            
        Returns:
            Tuple of (is_shift, version_type, trigger)
        """
        # Check for location change
        if self._is_location_change(current.spatial_context, new_context.get("spatial", {})):
            return True, VersionType.MAJOR, ShiftTrigger.LOCATION_CHANGE
        
        # Check for time transition
        if self._is_time_transition(current.temporal_context, new_context.get("temporal", {})):
            return True, VersionType.MINOR, ShiftTrigger.TIME_TRANSITION
        
        # Check for activity change
        if self._is_activity_change(current.situational_context, new_context.get("situational", {})):
            return True, VersionType.MINOR, ShiftTrigger.ACTIVITY_CHANGE
        
        # Check for drift
        if self._has_significant_drift(new_context):
            return True, VersionType.MINOR, ShiftTrigger.DRIFT_DETECTED
        
        # No major shift, but might be a patch
        diff = self.calculate_diff(current, new_context)
        if diff.change_count > 0:
            return True, VersionType.PATCH, ShiftTrigger.SCHEDULED
        
        return False, VersionType.PATCH, ShiftTrigger.SCHEDULED
    
    def _is_location_change(self, current: dict, new: dict) -> bool:
        """Check if location has changed significantly."""
        if not current or not new:
            return bool(new and not current)
        
        # Check city/region change
        if current.get("city") != new.get("city"):
            return True
        if current.get("region") != new.get("region"):
            return True
        
        # Check coordinate distance if available
        if all(k in current for k in ("latitude", "longitude")) and \
           all(k in new for k in ("latitude", "longitude")):
            distance = self._haversine_distance(
                current["latitude"], current["longitude"],
                new["latitude"], new["longitude"]
            )
            if distance > self.LOCATION_DISTANCE_KM_THRESHOLD:
                return True
        
        return False
    
    def _is_time_transition(self, current: dict, new: dict) -> bool:
        """Check if time has transitioned significantly."""
        if not current or not new:
            return False
        
        # Check day of week change
        if current.get("day_of_week") != new.get("day_of_week"):
            return True
        
        # Check time of day transition (morning->afternoon->evening->night)
        current_period = current.get("time_of_day")
        new_period = new.get("time_of_day")
        if current_period and new_period and current_period != new_period:
            return True
        
        return False
    
    def _is_activity_change(self, current: dict, new: dict) -> bool:
        """Check if activity has changed."""
        if not current or not new:
            return bool(new and not current)
        
        # Check task/activity change
        current_task = current.get("current_task") or current.get("activity")
        new_task = new.get("current_task") or new.get("activity")
        
        if current_task != new_task:
            return True
        
        return False
    
    def _has_significant_drift(self, context: dict) -> bool:
        """Check if context shows significant drift."""
        for type_context in context.values():
            if isinstance(type_context, dict):
                drift = type_context.get("drift_status")
                if drift in (DriftStatus.CONFLICTING.value, "conflicting"):
                    return True
        return False
    
    def _haversine_distance(
        self,
        lat1: float, lon1: float,
        lat2: float, lon2: float,
    ) -> float:
        """Calculate distance between two points in kilometers."""
        import math
        R = 6371  # Earth's radius in km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat/2)**2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    def calculate_diff(
        self,
        snapshot: ContextSnapshot,
        new_context: dict,
    ) -> ContextDiff:
        """Calculate diff between snapshot and new context."""
        diff = ContextDiff()
        
        # Flatten both for comparison
        old_flat = self._flatten_context(snapshot.get_all_context())
        new_flat = self._flatten_context(new_context)
        
        old_keys = set(old_flat.keys())
        new_keys = set(new_flat.keys())
        
        diff.added_keys = list(new_keys - old_keys)
        diff.removed_keys = list(old_keys - new_keys)
        
        for key in old_keys & new_keys:
            if old_flat[key] != new_flat[key]:
                diff.modified_keys.append(key)
                diff.changes[key] = {
                    "old": old_flat[key],
                    "new": new_flat[key],
                }
        
        return diff
    
    def _flatten_context(self, context: dict, prefix: str = "") -> dict:
        """Flatten nested context dict."""
        flat = {}
        for key, value in context.items():
            full_key = f"{prefix}.{key}" if prefix else key
            if isinstance(value, dict):
                flat.update(self._flatten_context(value, full_key))
            else:
                flat[full_key] = value
        return flat


class ContextVersionManager:
    """
    Manages semantic versioning of context reality.
    
    Features:
    - Automatic snapshots on major shifts
    - Version history with semantic versioning
    - Time travel (restoration to previous states)
    - Diff tracking between versions
    """
    
    MAX_HISTORY_PER_USER = 100          # Maximum snapshots to keep
    AUTO_SNAPSHOT_INTERVAL_MINUTES = 60  # Auto-snapshot interval
    
    def __init__(self, max_history: int = MAX_HISTORY_PER_USER):
        """
        Initialize the version manager.
        
        Args:
            max_history: Maximum snapshots to keep per user
        """
        self.max_history = max_history
        self.shift_detector = ShiftDetector()
        
        # Snapshot storage by user_id
        self._snapshots: dict[str, list[ContextSnapshot]] = {}
        
        # Current version per user
        self._current_versions: dict[str, SemanticVersion] = {}
        
        # Latest snapshot reference
        self._latest: dict[str, str] = {}  # user_id -> snapshot_id
    
    def create_snapshot(
        self,
        user_id: str,
        context: dict,
        trigger: ShiftTrigger = ShiftTrigger.MANUAL_SNAPSHOT,
        session_id: Optional[str] = None,
        description: str = "",
        tags: Optional[list[str]] = None,
        version_type: Optional[VersionType] = None,
    ) -> ContextSnapshot:
        """
        Create a new context snapshot.
        
        Args:
            user_id: User identifier
            context: Current context state
            trigger: What triggered the snapshot
            session_id: Optional session ID
            description: Optional description
            tags: Optional tags
            version_type: Force a specific version type
            
        Returns:
            New snapshot
        """
        # Get current version
        current_version = self._current_versions.get(
            user_id, SemanticVersion(1, 0, 0)
        )
        
        # Get parent snapshot
        parent_id = self._latest.get(user_id)
        parent = self.get_snapshot(user_id, parent_id) if parent_id else None
        
        # Determine version type if not specified
        if version_type is None and parent:
            _, detected_type, detected_trigger = self.shift_detector.detect_shift(
                parent, context
            )
            version_type = detected_type
            if trigger == ShiftTrigger.MANUAL_SNAPSHOT:
                trigger = detected_trigger
        elif version_type is None:
            version_type = VersionType.MAJOR  # First snapshot
        
        # Bump version
        new_version = current_version.bump(version_type)
        
        # Create snapshot
        snapshot = ContextSnapshot(
            snapshot_id=str(uuid.uuid4()),
            user_id=user_id,
            version=new_version,
            timestamp=datetime.now(timezone.utc),
            trigger=trigger,
            temporal_context=context.get("temporal", {}),
            spatial_context=context.get("spatial", {}),
            situational_context=context.get("situational", {}),
            meta_context=context.get("meta", {}),
            session_id=session_id,
            parent_snapshot_id=parent_id,
            description=description,
            tags=tags or [],
        )
        
        # Store snapshot
        if user_id not in self._snapshots:
            self._snapshots[user_id] = []
        
        self._snapshots[user_id].append(snapshot)
        self._current_versions[user_id] = new_version
        self._latest[user_id] = snapshot.snapshot_id
        
        # Prune old snapshots if needed
        self._prune_history(user_id)
        
        logger.info(
            "Context snapshot created",
            user_id=user_id,
            version=str(new_version),
            trigger=trigger.value,
            snapshot_id=snapshot.snapshot_id,
        )
        
        return snapshot
    
    def get_snapshot(
        self,
        user_id: str,
        snapshot_id: Optional[str] = None,
        version: Optional[str] = None,
    ) -> Optional[ContextSnapshot]:
        """
        Get a specific snapshot.
        
        Args:
            user_id: User identifier
            snapshot_id: Specific snapshot ID
            version: Specific version string
            
        Returns:
            Snapshot if found
        """
        if user_id not in self._snapshots:
            return None
        
        if snapshot_id:
            for snapshot in self._snapshots[user_id]:
                if snapshot.snapshot_id == snapshot_id:
                    return snapshot
        elif version:
            target = SemanticVersion.parse(version)
            for snapshot in self._snapshots[user_id]:
                if str(snapshot.version) == str(target):
                    return snapshot
        
        return None
    
    def get_latest_snapshot(self, user_id: str) -> Optional[ContextSnapshot]:
        """Get the most recent snapshot for a user."""
        snapshot_id = self._latest.get(user_id)
        if snapshot_id:
            return self.get_snapshot(user_id, snapshot_id)
        return None
    
    def get_history(
        self,
        user_id: str,
        limit: int = 10,
        since: Optional[datetime] = None,
        trigger_filter: Optional[ShiftTrigger] = None,
    ) -> list[ContextSnapshot]:
        """
        Get snapshot history for a user.
        
        Args:
            user_id: User identifier
            limit: Maximum snapshots to return
            since: Only snapshots after this time
            trigger_filter: Filter by trigger type
            
        Returns:
            List of snapshots (newest first)
        """
        if user_id not in self._snapshots:
            return []
        
        snapshots = self._snapshots[user_id].copy()
        
        # Apply filters
        if since:
            snapshots = [s for s in snapshots if s.timestamp > since]
        
        if trigger_filter:
            snapshots = [s for s in snapshots if s.trigger == trigger_filter]
        
        # Sort by timestamp descending
        snapshots.sort(key=lambda s: s.timestamp, reverse=True)
        
        return snapshots[:limit]
    
    def restore_to_version(
        self,
        user_id: str,
        version: str,
        create_restore_snapshot: bool = True,
    ) -> RestorationResult:
        """
        Restore context to a previous version ("time travel").
        
        Args:
            user_id: User identifier
            version: Version to restore to
            create_restore_snapshot: Whether to create a new snapshot after restore
            
        Returns:
            Restoration result
        """
        # Find target snapshot
        target = self.get_snapshot(user_id, version=version)
        if not target:
            return RestorationResult(
                success=False,
                restored_snapshot=None,
                new_snapshot=None,
                diff_from_current=ContextDiff(),
                message=f"Version {version} not found",
            )
        
        # Get current state
        current = self.get_latest_snapshot(user_id)
        
        # Calculate diff
        if current:
            diff = self.shift_detector.calculate_diff(
                current,
                target.get_all_context(),
            )
        else:
            diff = ContextDiff()
        
        # Create restoration snapshot
        new_snapshot = None
        if create_restore_snapshot:
            new_snapshot = self.create_snapshot(
                user_id=user_id,
                context=target.get_all_context(),
                trigger=ShiftTrigger.MANUAL_SNAPSHOT,
                description=f"Restored from version {version}",
                tags=["restoration", f"from-{version}"],
                version_type=VersionType.MAJOR,
            )
        
        logger.info(
            "Context restored to previous version",
            user_id=user_id,
            restored_version=version,
            new_version=str(new_snapshot.version) if new_snapshot else None,
            changes=diff.change_count,
        )
        
        return RestorationResult(
            success=True,
            restored_snapshot=target,
            new_snapshot=new_snapshot,
            diff_from_current=diff,
            message=f"Successfully restored to version {version}",
        )
    
    def restore_to_snapshot(
        self,
        user_id: str,
        snapshot_id: str,
        create_restore_snapshot: bool = True,
    ) -> RestorationResult:
        """
        Restore context to a specific snapshot.
        
        Args:
            user_id: User identifier
            snapshot_id: Snapshot ID to restore
            create_restore_snapshot: Whether to create a new snapshot
            
        Returns:
            Restoration result
        """
        target = self.get_snapshot(user_id, snapshot_id=snapshot_id)
        if not target:
            return RestorationResult(
                success=False,
                restored_snapshot=None,
                new_snapshot=None,
                diff_from_current=ContextDiff(),
                message=f"Snapshot {snapshot_id} not found",
            )
        
        return self.restore_to_version(
            user_id,
            str(target.version),
            create_restore_snapshot,
        )
    
    def get_diff_between_versions(
        self,
        user_id: str,
        from_version: str,
        to_version: str,
    ) -> Optional[ContextDiff]:
        """
        Get diff between two versions.
        
        Args:
            user_id: User identifier
            from_version: Starting version
            to_version: Ending version
            
        Returns:
            Diff if both versions found
        """
        from_snapshot = self.get_snapshot(user_id, version=from_version)
        to_snapshot = self.get_snapshot(user_id, version=to_version)
        
        if not from_snapshot or not to_snapshot:
            return None
        
        return self.shift_detector.calculate_diff(
            from_snapshot,
            to_snapshot.get_all_context(),
        )
    
    def should_snapshot(
        self,
        user_id: str,
        new_context: dict,
    ) -> tuple[bool, VersionType, ShiftTrigger]:
        """
        Check if new context warrants a snapshot.
        
        Args:
            user_id: User identifier
            new_context: New context data
            
        Returns:
            Tuple of (should_snapshot, version_type, trigger)
        """
        current = self.get_latest_snapshot(user_id)
        if not current:
            return True, VersionType.MAJOR, ShiftTrigger.SESSION_START
        
        # Check time since last snapshot
        elapsed = (datetime.now(timezone.utc) - current.timestamp).total_seconds()
        if elapsed > self.AUTO_SNAPSHOT_INTERVAL_MINUTES * 60:
            return True, VersionType.PATCH, ShiftTrigger.SCHEDULED
        
        # Detect shift
        return self.shift_detector.detect_shift(current, new_context)
    
    def get_version_stats(self, user_id: str) -> dict:
        """Get version statistics for a user."""
        if user_id not in self._snapshots:
            return {
                "total_snapshots": 0,
                "current_version": "0.0.0",
                "first_snapshot": None,
                "latest_snapshot": None,
                "major_changes": 0,
                "minor_changes": 0,
                "patch_changes": 0,
            }
        
        snapshots = self._snapshots[user_id]
        current = self._current_versions.get(user_id, SemanticVersion())
        
        # Count version types
        major_count = 0
        minor_count = 0
        patch_count = 0
        
        for i, snapshot in enumerate(snapshots):
            if i == 0:
                continue
            prev = snapshots[i-1]
            if snapshot.version.major > prev.version.major:
                major_count += 1
            elif snapshot.version.minor > prev.version.minor:
                minor_count += 1
            else:
                patch_count += 1
        
        return {
            "total_snapshots": len(snapshots),
            "current_version": str(current),
            "first_snapshot": snapshots[0].timestamp.isoformat() if snapshots else None,
            "latest_snapshot": snapshots[-1].timestamp.isoformat() if snapshots else None,
            "major_changes": major_count,
            "minor_changes": minor_count,
            "patch_changes": patch_count,
        }
    
    def _prune_history(self, user_id: str) -> int:
        """Prune old snapshots beyond max history."""
        if user_id not in self._snapshots:
            return 0
        
        snapshots = self._snapshots[user_id]
        if len(snapshots) <= self.max_history:
            return 0
        
        # Keep most recent snapshots
        pruned_count = len(snapshots) - self.max_history
        self._snapshots[user_id] = snapshots[-self.max_history:]
        
        logger.debug(
            "Pruned old snapshots",
            user_id=user_id,
            pruned=pruned_count,
            remaining=len(self._snapshots[user_id]),
        )
        
        return pruned_count
    
    def export_history(
        self,
        user_id: str,
        format: str = "json",
    ) -> str:
        """Export version history."""
        snapshots = self.get_history(user_id, limit=self.max_history)
        
        if format == "json":
            return json.dumps(
                [s.to_dict() for s in snapshots],
                indent=2,
                default=str,
            )
        else:
            # Simple text format
            lines = [f"Context Version History for {user_id}"]
            lines.append("=" * 50)
            for snapshot in snapshots:
                lines.append(
                    f"v{snapshot.version} - {snapshot.timestamp.isoformat()} "
                    f"[{snapshot.trigger.value}]"
                )
                if snapshot.description:
                    lines.append(f"  {snapshot.description}")
            return "\n".join(lines)


# Global instance
version_manager = ContextVersionManager()
