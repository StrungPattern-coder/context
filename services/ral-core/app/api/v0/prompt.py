"""
Prompt API v0 - Prompt Augmentation Endpoints

These endpoints are part of the stable v0 API contract.
"""

from datetime import datetime, timezone
from typing import Any, Literal, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_optional, TokenData
from app.engines.temporal import TemporalEngine
from app.engines.spatial import SpatialEngine

router = APIRouter()

# Initialize engines
temporal_engine = TemporalEngine()
spatial_engine = SpatialEngine()


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


class AugmentOptions(BaseModel):
    """Options for prompt augmentation."""
    include_types: Optional[list[str]] = Field(
        default=None,
        description="Context types to include: temporal, spatial, situational. None = auto-detect."
    )
    max_context_tokens: int = Field(default=200, ge=50, le=1000, description="Max tokens for context")
    injection_style: Literal["system", "prefix", "suffix"] = Field(
        default="system",
        description="Where to inject context"
    )


class AugmentRequest(BaseModel):
    """Request to augment a prompt with context."""
    user_id: str = Field(description="User identifier")
    prompt: str = Field(description="The original user prompt")
    provider: str = Field(default="openai", description="Target AI provider")
    signals: Signals = Field(default_factory=Signals, description="Context signals")
    options: AugmentOptions = Field(default_factory=AugmentOptions, description="Augmentation options")


class ContextDecision(BaseModel):
    """Decision about including a context type."""
    type: str
    included: bool
    reason: str


class AugmentMetadata(BaseModel):
    """Metadata about the augmentation."""
    provider: str
    context_tokens: int
    contexts_included: int
    contexts_excluded: int
    injection_style: str


class AugmentResponse(BaseModel):
    """Response with augmented prompt."""
    augment_id: str = Field(description="Unique augmentation ID")
    system_context: str = Field(description="Context to inject as system message")
    user_message: str = Field(description="Original user message (unmodified)")
    metadata: AugmentMetadata
    decisions: list[ContextDecision] = Field(description="Context inclusion decisions")


# ============================================================================
# Helper Functions
# ============================================================================

def _get_temporal_context(now: datetime, tz: str, locale: Optional[str] = None) -> dict:
    """Get temporal context using the engine's interpret method."""
    try:
        temporal_ctx = temporal_engine.interpret(
            timestamp=now,
            timezone=tz,
            session_start=None,
        )
        
        return {
            "date": temporal_ctx.date.isoformat() if temporal_ctx.date else now.date().isoformat(),
            "time": temporal_ctx.time.isoformat() if temporal_ctx.time else now.time().isoformat(),
            "timezone": temporal_ctx.timezone or tz,
            "day_of_week": temporal_ctx.weekday_name,
            "is_weekend": temporal_ctx.day_type.value == "weekend" if temporal_ctx.day_type else now.weekday() >= 5,
            "time_of_day": temporal_ctx.time_of_day.value if temporal_ctx.time_of_day else "unknown",
            "display_date": now.strftime("%A, %B %d, %Y"),
            "display_time": now.strftime("%I:%M %p"),
        }
    except Exception:
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
        spatial_ctx = spatial_engine.interpret(
            locale=locale or "en-US",
            country=country,
            region=region,
        )
        
        parts = [city, region, country]
        display_location = ", ".join(p for p in parts if p)
        
        return {
            "locale": spatial_ctx.locale,
            "country": spatial_ctx.country_code,
            "country_name": spatial_ctx.country_name,
            "region": region,
            "city": city,
            "display_location": display_location or "Unknown",
        }
    except Exception:
        parts = [city, region, country]
        display_location = ", ".join(p for p in parts if p)
        return {
            "locale": locale or "en-US",
            "country": country,
            "region": region,
            "city": city,
            "display_location": display_location or "Unknown",
        }


def _build_system_context(
    contexts: list[tuple[str, dict]],
    provider: str,
    max_tokens: int,
) -> str:
    """Build the system context string for injection."""
    if not contexts:
        return ""
    
    lines = ["Current context for this user:"]
    
    for ctx_type, ctx_data in contexts:
        if ctx_type == "temporal":
            if "display_date" in ctx_data:
                lines.append(f"- Current date: {ctx_data['display_date']}")
            if "display_time" in ctx_data:
                lines.append(f"- Current time: {ctx_data['display_time']}")
            if "timezone" in ctx_data:
                lines.append(f"- Timezone: {ctx_data['timezone']}")
            if "day_of_week" in ctx_data:
                lines.append(f"- Day: {ctx_data['day_of_week']}")
            if "is_weekend" in ctx_data:
                lines.append(f"- {'Weekend' if ctx_data['is_weekend'] else 'Weekday'}")
        
        elif ctx_type == "spatial":
            if "display_location" in ctx_data:
                lines.append(f"- Location: {ctx_data['display_location']}")
            elif "city" in ctx_data:
                parts = [ctx_data.get("city"), ctx_data.get("region"), ctx_data.get("country")]
                location = ", ".join(p for p in parts if p)
                lines.append(f"- Location: {location}")
        
        elif ctx_type == "situational":
            for key, value in ctx_data.items():
                lines.append(f"- {key.replace('_', ' ').title()}: {value}")
    
    result = "\n".join(lines)
    
    # Truncate if over token limit (rough estimate: 4 chars per token)
    max_chars = max_tokens * 4
    if len(result) > max_chars:
        result = result[:max_chars - 3] + "..."
    
    # Provider-specific formatting
    if provider == "anthropic":
        result = f"<context>\n{result}\n</context>"
    elif provider == "google":
        result = f"[User Context]\n{result}\n[End Context]"
    
    return result


# ============================================================================
# Endpoints (Public Contract)
# ============================================================================

@router.post("/augment", response_model=AugmentResponse)
async def augment_prompt(
    request: AugmentRequest,
    current_user: Optional[TokenData] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> AugmentResponse:
    """
    Augment a user prompt with relevant context.
    
    This endpoint analyzes the user's prompt and injects relevant context
    based on the content and available signals. Use this before sending
    prompts to any AI provider.
    
    **Context Injection:**
    - Temporal: Injected when prompt mentions time/dates/scheduling
    - Spatial: Injected when prompt mentions locations or "here"
    - Situational: Injected from stored user preferences
    
    **Provider Support:**
    - openai: Standard format
    - anthropic: XML-wrapped context
    - google: Bracketed context
    
    **Guarantees:**
    - Fast: <50ms p99 latency target
    - Deterministic: Same input → same output
    - Safe: Original message never modified
    """
    augment_id = f"aug_{uuid.uuid4().hex[:12]}"
    
    # Parse timestamp
    now = datetime.now(timezone.utc)
    if request.signals.timestamp:
        try:
            now = datetime.fromisoformat(request.signals.timestamp.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid timestamp format. Use ISO 8601."
            )
    
    # Build context components
    contexts: list[tuple[str, dict]] = []
    decisions: list[ContextDecision] = []
    
    tz = request.signals.timezone or "UTC"
    prompt_lower = request.prompt.lower()
    
    # Temporal context
    include_temporal = (
        request.options.include_types is None or 
        "temporal" in request.options.include_types
    )
    
    has_temporal_ref = any(word in prompt_lower for word in [
        "today", "tomorrow", "yesterday", "now", "time", "when",
        "morning", "afternoon", "evening", "night", "week", "month",
        "schedule", "deadline", "meeting", "appointment", "date"
    ])
    
    if include_temporal and has_temporal_ref:
        temporal = _get_temporal_context(now, tz, request.signals.locale)
        contexts.append(("temporal", temporal))
        decisions.append(ContextDecision(
            type="temporal",
            included=True,
            reason="contains_time_reference",
        ))
    elif include_temporal:
        decisions.append(ContextDecision(
            type="temporal",
            included=False,
            reason="no_time_reference",
        ))
    
    # Spatial context
    include_spatial = (
        request.options.include_types is None or 
        "spatial" in request.options.include_types
    )
    
    has_spatial_ref = any(word in prompt_lower for word in [
        "here", "nearby", "location", "where", "local", "weather",
        "restaurant", "store", "place", "area", "city", "country"
    ])
    
    if include_spatial and has_spatial_ref and request.signals.city:
        spatial = _get_spatial_context(
            locale=request.signals.locale,
            country=request.signals.country,
            region=request.signals.region,
            city=request.signals.city,
        )
        contexts.append(("spatial", spatial))
        decisions.append(ContextDecision(
            type="spatial",
            included=True,
            reason="contains_location_reference",
        ))
    elif include_spatial:
        decisions.append(ContextDecision(
            type="spatial",
            included=False,
            reason="no_location_reference" if not has_spatial_ref else "no_location_signals",
        ))
    
    # Build system context string
    system_context = _build_system_context(
        contexts=contexts,
        provider=request.provider,
        max_tokens=request.options.max_context_tokens,
    )
    
    # Estimate tokens (rough: 4 chars per token)
    context_tokens = len(system_context) // 4
    
    return AugmentResponse(
        augment_id=augment_id,
        system_context=system_context,
        user_message=request.prompt,
        metadata=AugmentMetadata(
            provider=request.provider,
            context_tokens=context_tokens,
            contexts_included=sum(1 for d in decisions if d.included),
            contexts_excluded=sum(1 for d in decisions if not d.included),
            injection_style=request.options.injection_style,
        ),
        decisions=decisions,
    )
