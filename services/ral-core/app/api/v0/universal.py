"""
RAL Universal API - Single endpoint for all integrations

This module provides a unified API that works with:
- Browser extensions
- Python applications
- JavaScript/TypeScript apps  
- HTTP clients (curl, etc.)
- Any AI provider integration
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Literal, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_optional, TokenData
from app.engines.temporal import TemporalEngine
from app.engines.spatial import SpatialEngine

router = APIRouter(tags=["Universal API"])

# Initialize engines
temporal_engine = TemporalEngine()
spatial_engine = SpatialEngine()


# ============================================================================
# Universal Request/Response Models
# ============================================================================

class UniversalRequest(BaseModel):
    """
    Universal context request - works for all use cases.
    
    Minimal example:
    ```json
    {"prompt": "What's the weather like today?"}
    ```
    
    Full example:
    ```json
    {
        "prompt": "Schedule a meeting for tomorrow",
        "user_id": "user_123",
        "provider": "openai",
        "signals": {
            "timezone": "America/New_York",
            "locale": "en-US"
        }
    }
    ```
    """
    prompt: str = Field(description="User prompt to augment")
    user_id: Optional[str] = Field(default=None, description="User identifier (auto-generated if not provided)")
    provider: str = Field(default="openai", description="Target AI provider: openai, anthropic, google, etc.")
    
    # Optional signals
    signals: Optional[dict] = Field(default=None, description="Context signals (timezone, locale, etc.)")
    
    # Options
    include_types: Optional[list[str]] = Field(default=None, description="Context types to include")
    max_tokens: int = Field(default=200, ge=50, le=1000, description="Max context tokens")
    format: Literal["system", "prefix", "suffix", "raw"] = Field(default="system", description="Output format")


class UniversalResponse(BaseModel):
    """Universal context response."""
    
    # Core output
    system_context: str = Field(description="Context to inject as system message")
    user_prompt: str = Field(description="Original user prompt (unchanged)")
    augmented_prompt: Optional[str] = Field(default=None, description="Combined context + prompt if format=prefix")
    
    # Metadata
    request_id: str
    timestamp: datetime
    provider: str
    context_tokens: int
    
    # Details
    context: dict = Field(description="Structured context data")


# ============================================================================
# Provider-Specific Formatters
# ============================================================================

PROVIDER_FORMATS = {
    "openai": {
        "system_prefix": "Current user context:\n",
        "system_suffix": "",
        "wrapper": None,
    },
    "anthropic": {
        "system_prefix": "",
        "system_suffix": "",
        "wrapper": ("<context>", "</context>"),
    },
    "google": {
        "system_prefix": "[User Context]\n",
        "system_suffix": "\n[End Context]",
        "wrapper": None,
    },
    "perplexity": {
        "system_prefix": "User's current context:\n",
        "system_suffix": "",
        "wrapper": None,
    },
    "cohere": {
        "system_prefix": "Context about the user:\n",
        "system_suffix": "",
        "wrapper": None,
    },
    "mistral": {
        "system_prefix": "[Context]\n",
        "system_suffix": "\n[/Context]",
        "wrapper": None,
    },
    "llama": {
        "system_prefix": "### Context\n",
        "system_suffix": "\n### End Context",
        "wrapper": None,
    },
    "default": {
        "system_prefix": "Context: ",
        "system_suffix": "",
        "wrapper": None,
    },
}


def format_context_for_provider(context_lines: list[str], provider: str) -> str:
    """Format context string for specific provider."""
    fmt = PROVIDER_FORMATS.get(provider, PROVIDER_FORMATS["default"])
    
    content = "\n".join(context_lines)
    
    if fmt["wrapper"]:
        content = f"{fmt['wrapper'][0]}\n{content}\n{fmt['wrapper'][1]}"
    else:
        content = f"{fmt['system_prefix']}{content}{fmt['system_suffix']}"
    
    return content


# ============================================================================
# Context Generation
# ============================================================================

def generate_context(signals: Optional[dict] = None) -> dict:
    """Generate context from signals or defaults."""
    now = datetime.now(timezone.utc)
    signals = signals or {}
    
    tz = signals.get("timezone") or "UTC"
    locale = signals.get("locale") or "en-US"
    
    try:
        # Use temporal engine
        temporal_ctx = temporal_engine.interpret(
            timestamp=now,
            timezone=tz,
            session_start=None,
        )
        
        context = {
            "temporal": {
                "date": temporal_ctx.date.isoformat() if temporal_ctx.date else now.date().isoformat(),
                "time": temporal_ctx.time.isoformat() if temporal_ctx.time else now.time().isoformat(),
                "timezone": temporal_ctx.timezone or tz,
                "day_of_week": temporal_ctx.weekday_name,
                "is_weekend": temporal_ctx.day_type.value == "weekend" if temporal_ctx.day_type else now.weekday() >= 5,
                "time_of_day": temporal_ctx.time_of_day.value if temporal_ctx.time_of_day else "unknown",
                "display_date": now.strftime("%A, %B %d, %Y"),
                "display_time": now.strftime("%I:%M %p"),
            },
            "locale": {
                "code": locale,
                "language": locale.split("-")[0],
            }
        }
    except Exception:
        # Fallback
        hour = now.hour
        if hour >= 5 and hour < 12:
            time_of_day = "morning"
        elif hour >= 12 and hour < 17:
            time_of_day = "afternoon"
        elif hour >= 17 and hour < 21:
            time_of_day = "evening"
        else:
            time_of_day = "night"
        
        context = {
            "temporal": {
                "date": now.date().isoformat(),
                "time": now.time().isoformat(),
                "timezone": tz,
                "day_of_week": now.strftime("%A"),
                "is_weekend": now.weekday() >= 5,
                "time_of_day": time_of_day,
                "display_date": now.strftime("%A, %B %d, %Y"),
                "display_time": now.strftime("%I:%M %p"),
            },
            "locale": {
                "code": locale,
                "language": locale.split("-")[0],
            }
        }
    
    return context


def build_context_lines(context: dict, include_types: Optional[list[str]] = None) -> list[str]:
    """Build context as list of lines."""
    lines = []
    include_types = include_types or ["temporal"]
    
    if "temporal" in include_types:
        t = context.get("temporal", {})
        if t.get("display_date"):
            lines.append(f"Current date: {t['display_date']}")
        if t.get("display_time") and t.get("timezone"):
            lines.append(f"Current time: {t['display_time']} ({t['timezone']})")
        elif t.get("display_time"):
            lines.append(f"Current time: {t['display_time']}")
        if t.get("time_of_day"):
            lines.append(f"Time of day: {t['time_of_day']}")
        if t.get("is_weekend"):
            lines.append("It's the weekend")
    
    if "spatial" in include_types:
        s = context.get("spatial", {})
        if s.get("display_location"):
            lines.append(f"Location: {s['display_location']}")
    
    return lines


def should_include_context(prompt: str) -> bool:
    """Determine if prompt needs context based on content."""
    prompt_lower = prompt.lower()
    
    keywords = [
        "today", "tomorrow", "yesterday", "now", "current", "time",
        "morning", "afternoon", "evening", "night", "weekend",
        "schedule", "meeting", "appointment", "deadline", "when",
        "here", "nearby", "local", "weather", "location",
    ]
    
    return any(kw in prompt_lower for kw in keywords)


# ============================================================================
# Endpoint
# ============================================================================

@router.post("/augment", response_model=UniversalResponse)
async def universal_augment(
    request: UniversalRequest,
    x_ral_user: Optional[str] = Header(default=None, alias="X-RAL-User"),
    current_user: Optional[TokenData] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> UniversalResponse:
    """
    Universal context augmentation endpoint.
    
    Works with any AI provider and any client type.
    
    **Quick Start:**
    ```bash
    curl -X POST http://localhost:8000/api/universal/augment \\
      -H "Content-Type: application/json" \\
      -d '{"prompt": "What should I do today?"}'
    ```
    
    **With Signals:**
    ```bash
    curl -X POST http://localhost:8000/api/universal/augment \\
      -H "Content-Type: application/json" \\
      -d '{
        "prompt": "Schedule a meeting for tomorrow",
        "signals": {"timezone": "America/New_York"},
        "provider": "anthropic"
      }'
    ```
    
    **Response Usage (OpenAI example):**
    ```python
    response = requests.post(RAL_URL, json={"prompt": user_input})
    result = response.json()
    
    completion = openai.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": result["system_context"]},
            {"role": "user", "content": result["user_prompt"]}
        ]
    )
    ```
    """
    request_id = f"ral_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    # Get user ID from header, request, or token
    user_id = x_ral_user or request.user_id or (current_user.user_id if current_user else None) or "anonymous"
    
    # Check if context should be included
    include_types = request.include_types or ["temporal"]
    if not should_include_context(request.prompt) and request.include_types is None:
        # Return minimal response without context
        return UniversalResponse(
            system_context="",
            user_prompt=request.prompt,
            augmented_prompt=request.prompt,
            request_id=request_id,
            timestamp=now,
            provider=request.provider,
            context_tokens=0,
            context={},
        )
    
    # Generate context
    context = generate_context(request.signals)
    
    # Build context lines
    context_lines = build_context_lines(context, include_types)
    
    # Format for provider
    system_context = format_context_for_provider(context_lines, request.provider)
    
    # Build augmented prompt if needed
    augmented_prompt = None
    if request.format == "prefix":
        augmented_prompt = f"{system_context}\n\n{request.prompt}"
    elif request.format == "suffix":
        augmented_prompt = f"{request.prompt}\n\n{system_context}"
    
    # Estimate tokens
    context_tokens = len(system_context) // 4
    
    return UniversalResponse(
        system_context=system_context,
        user_prompt=request.prompt,
        augmented_prompt=augmented_prompt,
        request_id=request_id,
        timestamp=now,
        provider=request.provider,
        context_tokens=context_tokens,
        context=context,
    )


@router.get("/context")
async def get_current_context(
    tz: str = "UTC",
    locale: str = "en-US",
) -> dict:
    """
    Get current context without a prompt.
    
    Useful for:
    - Debugging
    - Pre-fetching context
    - Building custom integrations
    """
    context = generate_context({
        "timezone": tz,
        "locale": locale,
    })
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "context": context,
    }
