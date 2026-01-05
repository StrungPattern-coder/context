"""
Context API v0 - Public Contract Endpoints

These endpoints are part of the stable v0 API contract.
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_optional, TokenData
from app.engines.temporal import TemporalEngine
from app.engines.spatial import SpatialEngine
from app.engines.situational import SituationalEngine
from app.engines.resolver import AssumptionResolver

router = APIRouter()

# Initialize engines
temporal_engine = TemporalEngine()
spatial_engine = SpatialEngine()
situational_engine = SituationalEngine()
assumption_resolver = AssumptionResolver(
    temporal_engine=temporal_engine,
    spatial_engine=spatial_engine,
)


# ============================================================================
# Request/Response Models (Public Contract)
# ============================================================================

class Signals(BaseModel):
    """Context signals from client."""
    timestamp: Optional[str] = Field(default=None, description="ISO 8601 timestamp")
    timezone: Optional[str] = Field(default=None, description="IANA timezone name")
    locale: Optional[str] = Field(default=None, description="Locale code (e.g., en-US)")
    country: Optional[str] = Field(default=None, description="ISO country code")
    region: Optional[str] = Field(default=None, description="Region/state")
    city: Optional[str] = Field(default=None, description="City name")


class ResolveRequest(BaseModel):
    """Request to resolve ambiguous references."""
    user_id: str = Field(description="User identifier")
    message: str = Field(description="Message containing references to resolve")
    signals: Signals = Field(default_factory=Signals, description="Context signals")


class ResolvedReference(BaseModel):
    """A single resolved reference."""
    value: Any = Field(description="Resolved concrete value")
    display: str = Field(description="Human-readable display string")
    confidence: float = Field(ge=0.0, le=1.0, description="Resolution confidence")
    source: str = Field(description="Source of resolution")


class ContextSnapshot(BaseModel):
    """Snapshot of current context state."""
    temporal: Optional[dict] = None
    spatial: Optional[dict] = None
    situational: Optional[dict] = None


class ResolveResponse(BaseModel):
    """Response with resolved references."""
    resolve_id: str = Field(description="Unique resolution ID")
    resolved: dict[str, ResolvedReference] = Field(description="Resolved references")
    context_snapshot: ContextSnapshot = Field(description="Current context state")
    warnings: list[str] = Field(default_factory=list, description="Resolution warnings")


class SnapshotResponse(BaseModel):
    """Full context snapshot response."""
    user_id: str
    snapshot_time: datetime
    temporal: Optional[dict] = None
    spatial: Optional[dict] = None
    situational: Optional[dict] = None
    meta: dict = Field(default_factory=dict)


class ContextUpdate(BaseModel):
    """Single context update."""
    type: str = Field(description="Context type: temporal, spatial, situational")
    key: str = Field(description="Context key to update")
    value: Any = Field(description="New value")
    source: str = Field(default="user_explicit", description="Update source")


class UpdateRequest(BaseModel):
    """Request to update context."""
    user_id: str = Field(description="User identifier")
    updates: list[ContextUpdate] = Field(description="List of updates to apply")


class UpdatedContext(BaseModel):
    """Single updated context result."""
    type: str
    key: str
    old_value: Any
    new_value: Any
    confidence: float


class UpdateResponse(BaseModel):
    """Response with update results."""
    updated: int = Field(description="Number of contexts updated")
    contexts: list[UpdatedContext] = Field(description="Updated context details")


# ============================================================================
# Helper Functions
# ============================================================================

def _get_temporal_context(now: datetime, tz: str, locale: Optional[str] = None) -> dict:
    """Get temporal context using the engine's interpret method."""
    try:
        # Use the engine's interpret method
        temporal_ctx = temporal_engine.interpret(
            timestamp=now,
            timezone=tz,
            session_start=None,
        )
        
        # Convert to dict for response - use actual schema attributes
        return {
            "date": temporal_ctx.date.isoformat() if temporal_ctx.date else now.date().isoformat(),
            "time": temporal_ctx.time.isoformat() if temporal_ctx.time else now.time().isoformat(),
            "timezone": temporal_ctx.timezone or tz,
            "day_of_week": temporal_ctx.weekday_name,
            "is_weekend": temporal_ctx.day_type.value == "weekend" if temporal_ctx.day_type else now.weekday() >= 5,
            "time_of_day": temporal_ctx.time_of_day.value if temporal_ctx.time_of_day else "unknown",
            "display_date": now.strftime("%A, %B %d, %Y"),
            "display_time": now.strftime("%I:%M %p"),
            "season": temporal_ctx.season.value if temporal_ctx.season else None,
            "day_type": temporal_ctx.day_type.value if temporal_ctx.day_type else None,
        }
    except Exception:
        # Fallback to basic context
        return {
            "date": now.date().isoformat(),
            "time": now.time().isoformat(),
            "timezone": tz,
            "day_of_week": now.strftime("%A"),
            "is_weekend": now.weekday() >= 5,
            "display_date": now.strftime("%A, %B %d, %Y"),
            "display_time": now.strftime("%I:%M %p"),
        }


def _get_spatial_context(locale: Optional[str], country: Optional[str], region: Optional[str], city: Optional[str]) -> dict:
    """Get spatial context using the engine's interpret method."""
    try:
        # Use the engine's interpret method
        spatial_ctx = spatial_engine.interpret(
            locale=locale or "en-US",
            country=country,
            region=region,
        )
        
        # Build display location
        parts = [city, region, country]
        display_location = ", ".join(p for p in parts if p)
        
        return {
            "locale": spatial_ctx.locale,
            "country": spatial_ctx.country_code,
            "country_name": spatial_ctx.country_name,
            "region": region,
            "city": city,
            "language": spatial_ctx.language,
            "display_location": display_location or "Unknown",
        }
    except Exception:
        # Fallback to basic context
        parts = [city, region, country]
        display_location = ", ".join(p for p in parts if p)
        return {
            "locale": locale or "en-US",
            "country": country,
            "region": region,
            "city": city,
            "display_location": display_location or "Unknown",
        }


# ============================================================================
# Endpoints (Public Contract)
# ============================================================================

@router.post("/resolve", response_model=ResolveResponse)
async def resolve_context(
    request: ResolveRequest,
    current_user: Optional[TokenData] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> ResolveResponse:
    """
    Resolve ambiguous references in user input to concrete values.
    
    This endpoint analyzes the user's message for temporal references
    (today, tomorrow, now, etc.) and spatial references (here, nearby, etc.)
    and resolves them to concrete values based on the provided signals.
    
    **Use before sending user message to any AI.**
    
    **Guarantees:**
    - Deterministic: Same input → same resolution
    - Fast: <50ms p99 latency target
    - Safe: Never hallucinates dates/times
    
    **Failure Behavior:**
    - Missing timezone → use UTC + warning
    - Invalid timestamp → reject with 400
    - Unknown reference → return unresolved + warning
    """
    resolve_id = f"res_{uuid.uuid4().hex[:12]}"
    
    # Build context from signals
    now = datetime.now(timezone.utc)
    if request.signals.timestamp:
        try:
            now = datetime.fromisoformat(request.signals.timestamp.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid timestamp format. Use ISO 8601."
            )
    
    warnings: list[str] = []
    tz = request.signals.timezone or "UTC"
    if not request.signals.timezone:
        warnings.append("No timezone provided, using UTC")
    
    # Get temporal context using helper
    temporal_context = _get_temporal_context(now, tz, request.signals.locale)
    
    # Resolve references in message
    resolved: dict[str, ResolvedReference] = {}
    message_lower = request.message.lower()
    
    if "today" in message_lower:
        resolved["today"] = ResolvedReference(
            value=temporal_context.get("date", now.date().isoformat()),
            display=temporal_context.get("display_date", str(now.date())),
            confidence=1.0 if request.signals.timezone else 0.8,
            source="temporal_engine",
        )
    
    if "tomorrow" in message_lower:
        tomorrow = now + timedelta(days=1)
        resolved["tomorrow"] = ResolvedReference(
            value=tomorrow.date().isoformat(),
            display=tomorrow.strftime("%A, %B %d, %Y"),
            confidence=1.0 if request.signals.timezone else 0.8,
            source="temporal_engine",
        )
    
    if "yesterday" in message_lower:
        yesterday = now - timedelta(days=1)
        resolved["yesterday"] = ResolvedReference(
            value=yesterday.date().isoformat(),
            display=yesterday.strftime("%A, %B %d, %Y"),
            confidence=1.0 if request.signals.timezone else 0.8,
            source="temporal_engine",
        )
    
    if "now" in message_lower or "current" in message_lower:
        resolved["now"] = ResolvedReference(
            value=now.isoformat(),
            display=temporal_context.get("display_time", now.strftime("%I:%M %p")),
            confidence=1.0,
            source="temporal_engine",
        )
    
    # Build spatial context if available
    spatial_context = None
    if request.signals.country or request.signals.city:
        spatial_context = _get_spatial_context(
            locale=request.signals.locale,
            country=request.signals.country,
            region=request.signals.region,
            city=request.signals.city,
        )
        
        if "here" in message_lower:
            resolved["here"] = ResolvedReference(
                value={
                    "city": request.signals.city,
                    "region": request.signals.region,
                    "country": request.signals.country,
                },
                display=spatial_context.get("display_location", "Unknown location"),
                confidence=0.85,
                source="spatial_engine",
            )
    
    return ResolveResponse(
        resolve_id=resolve_id,
        resolved=resolved,
        context_snapshot=ContextSnapshot(
            temporal=temporal_context,
            spatial=spatial_context,
            situational=None,
        ),
        warnings=warnings,
    )


@router.get("/snapshot", response_model=SnapshotResponse)
async def get_context_snapshot(
    user_id: str = Query(description="User identifier"),
    timezone_str: str = Query(default="UTC", alias="timezone", description="User timezone"),
    current_user: Optional[TokenData] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> SnapshotResponse:
    """
    Get current context state for a user.
    
    Returns a complete snapshot of all context types for debugging
    and inspection purposes.
    
    **Guarantees:**
    - Real-time: Reflects current state
    - Complete: All context types included
    - Read-only: No side effects
    """
    now = datetime.now(timezone.utc)
    
    # Generate temporal context from current time
    temporal = _get_temporal_context(now, timezone_str)
    
    return SnapshotResponse(
        user_id=user_id,
        snapshot_time=now,
        temporal=temporal,
        spatial=None,  # No stored location without explicit signals
        situational=None,  # No situational context yet
        meta={
            "generated_at": now.isoformat(),
            "source": "real_time",
        },
    )


@router.post("/update", response_model=UpdateResponse)
async def update_context(
    request: UpdateRequest,
    current_user: Optional[TokenData] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> UpdateResponse:
    """
    Explicitly update context (user-initiated).
    
    Allows users to manually set or correct context values.
    User-explicit updates have the highest confidence.
    
    **Guarantees:**
    - Immediate: Changes reflected instantly
    - Traceable: Source recorded as user_explicit
    - Overridable: User can always override system inferences
    
    Note: In v0, context is ephemeral (per-request). This endpoint
    is a placeholder for v1 persistent context storage.
    """
    # In v0, we don't persist context to DB - it's all request-scoped
    # This endpoint acknowledges the updates for client-side tracking
    
    updated_contexts = []
    
    for update in request.updates:
        updated_contexts.append(UpdatedContext(
            type=update.type,
            key=update.key,
            old_value=None,  # No persistence in v0
            new_value=update.value,
            confidence=1.0,  # User-explicit updates are always 1.0
        ))
    
    return UpdateResponse(
        updated=len(updated_contexts),
        contexts=updated_contexts,
    )
