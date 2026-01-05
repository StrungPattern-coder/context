"""
Prompt Composition API Endpoints

API for composing context-aware prompts for LLM interactions.
"""

from datetime import datetime, timezone
from typing import Any, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, TokenData
from app.models.context import Context, ContextType
from app.engines.composer import PromptComposer, InjectionStyle
from app.engines.temporal import TemporalEngine
from app.engines.spatial import SpatialEngine
from app.engines.situational import SituationalEngine

router = APIRouter()

# Initialize engines
prompt_composer = PromptComposer()
temporal_engine = TemporalEngine()
spatial_engine = SpatialEngine()
situational_engine = SituationalEngine()


# Request/Response Models

class ComposeRequest(BaseModel):
    """Request to compose a context-aware prompt."""
    user_id: str = Field(description="User identifier")
    original_prompt: str = Field(description="The user's original message/prompt")
    provider: str = Field(
        default="openai",
        description="Target LLM provider (openai, anthropic, google, generic)"
    )
    injection_style: str = Field(
        default="system_prompt",
        description="How to inject context (system_prompt, context_block, inline)"
    )
    max_context_tokens: Optional[int] = Field(
        default=None,
        description="Override max tokens for context"
    )
    include_types: Optional[list[str]] = Field(
        default=None,
        description="Context types to include (temporal, spatial, situational)"
    )
    session_id: Optional[str] = Field(default=None, description="Session ID")


class ComposeResponse(BaseModel):
    """Composed prompt response."""
    composed_id: str
    system_context: str
    user_message: str
    provider: str
    included_context_count: int
    excluded_context_count: int
    total_tokens: int
    composition_time: datetime
    decisions: list[dict] = []


class QuickAnchorRequest(BaseModel):
    """Quick anchor and compose in one request."""
    user_id: str
    message: str
    timestamp: Optional[str] = None
    timezone: Optional[str] = None
    locale: Optional[str] = None
    provider: str = "openai"
    session_id: Optional[str] = None


class QuickAnchorResponse(BaseModel):
    """Response with anchored context and composed prompt."""
    anchor_id: str
    system_context: str
    user_message: str
    context_summary: dict
    confidence: float
    provider: str


# Endpoints

@router.post("/compose", response_model=ComposeResponse)
async def compose_prompt(
    request: ComposeRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ComposeResponse:
    """
    Compose a context-aware prompt.
    
    Retrieves the user's current context and composes a prompt with
    appropriate context injection based on relevance analysis.
    """
    composed_id = str(uuid.uuid4())
    
    # Get user's current context from database
    try:
        user_uuid = uuid.UUID(request.user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format",
        )
    
    # Build query conditions
    conditions = [
        Context.user_id == user_uuid,
        Context.is_active == True,
    ]
    
    # Filter by context types if specified
    if request.include_types:
        type_conditions = []
        for ct in request.include_types:
            try:
                type_conditions.append(Context.context_type == ContextType(ct))
            except ValueError:
                pass
        if type_conditions:
            from sqlalchemy import or_
            conditions.append(or_(*type_conditions))
    
    result = await db.execute(
        select(Context).where(and_(*conditions))
    )
    contexts = result.scalars().all()
    
    # Build context dicts for composer
    temporal_context = None
    spatial_context = None
    situational_context = None
    
    for ctx in contexts:
        if ctx.context_type == ContextType.TEMPORAL:
            temporal_context = ctx.value
        elif ctx.context_type == ContextType.SPATIAL:
            spatial_context = ctx.value
        elif ctx.context_type == ContextType.SITUATIONAL:
            situational_context = ctx.value
    
    # If no stored context, generate fresh temporal context
    if not temporal_context:
        temporal_interpretation = temporal_engine.interpret(timestamp=datetime.now(timezone.utc))
        temporal_context = temporal_interpretation.model_dump()
    
    # Parse injection style
    try:
        style = InjectionStyle(request.injection_style)
    except ValueError:
        style = InjectionStyle.SYSTEM_PROMPT
    
    # Create composer with custom settings if provided
    composer = prompt_composer
    if request.max_context_tokens:
        composer = PromptComposer(max_tokens=request.max_context_tokens)
    
    # Compose the prompt
    composed = composer.compose(
        user_message=request.original_prompt,
        temporal_context=temporal_context,
        spatial_context=spatial_context,
        situational_context=situational_context,
        injection_style=style,
    )
    
    # Get composition decisions for transparency
    decisions = composer.explain_decisions(composed)
    
    return ComposeResponse(
        composed_id=composed_id,
        system_context=composed.system_context,
        user_message=composed.user_message,
        provider=request.provider,
        included_context_count=len(composed.included_context),
        excluded_context_count=len(composed.excluded_context),
        total_tokens=composed.total_tokens,
        composition_time=composed.composition_time,
        decisions=[
            {
                "key": d.element_key,
                "included": d.included,
                "reason": d.reason,
            }
            for d in decisions
        ],
    )


@router.post("/quick", response_model=QuickAnchorResponse)
async def quick_anchor_and_compose(
    request: QuickAnchorRequest,
    current_user: TokenData = Depends(get_current_user),
) -> QuickAnchorResponse:
    """
    Quick anchor and compose in a single request.
    
    Convenience endpoint that anchors context and composes a prompt
    in one call. Useful for simple integrations.
    """
    anchor_id = str(uuid.uuid4())
    
    # Process temporal context
    timestamp = datetime.fromisoformat(request.timestamp) if request.timestamp else datetime.now(timezone.utc)
    temporal_interpretation = temporal_engine.interpret(
        timestamp=timestamp,
        timezone=request.timezone,
    )
    temporal_context = temporal_interpretation.model_dump()
    
    # Process spatial context if locale provided
    spatial_context = None
    if request.locale:
        spatial_interpretation = spatial_engine.interpret(locale=request.locale)
        spatial_context = spatial_interpretation.model_dump()
    
    # Process situational context
    situational_interpretation = situational_engine.interpret(
        user_id=request.user_id,
        message=request.message,
        session_id=request.session_id,
    )
    situational_context = situational_interpretation.to_dict()
    
    # Compose prompt
    composed = prompt_composer.compose(
        user_message=request.message,
        temporal_context=temporal_context,
        spatial_context=spatial_context,
        situational_context=situational_context,
    )
    
    # Build context summary
    context_summary = {
        "temporal": {
            "time": temporal_context.get("formatted", {}).get("time"),
            "date": temporal_context.get("formatted", {}).get("date"),
            "timezone": temporal_context.get("timezone"),
        },
        "spatial": {
            "locale": spatial_context.get("locale") if spatial_context else None,
        } if spatial_context else None,
        "situational": {
            "active_tasks": len(situational_context.get("active_tasks", [])),
            "references": len(situational_context.get("references", [])),
        },
    }
    
    # Calculate confidence
    confidences = [
        temporal_context.get("confidence", {}).get("score", 0.5),
    ]
    if spatial_context:
        confidences.append(spatial_context.get("confidence", {}).get("score", 0.5))
    confidences.append(situational_context.get("confidence", {}).get("score", 0.5))
    
    overall_confidence = sum(confidences) / len(confidences)
    
    return QuickAnchorResponse(
        anchor_id=anchor_id,
        system_context=composed.system_context,
        user_message=composed.user_message,
        context_summary=context_summary,
        confidence=overall_confidence,
        provider=request.provider,
    )


@router.get("/preview/{user_id}")
async def preview_context(
    user_id: str,
    message: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Preview what context would be included for a message.
    
    Useful for debugging and understanding context behavior
    without actually composing a prompt.
    """
    # Analyze the message
    relevance_signals = prompt_composer._analyze_message(message)
    
    # Get stored context
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format",
        )
    
    result = await db.execute(
        select(Context).where(
            Context.user_id == user_uuid,
            Context.is_active == True,
        )
    )
    contexts = result.scalars().all()
    
    # Build preview
    preview = {
        "message_analysis": {
            "temporal_relevance": relevance_signals.get("temporal", 0.0),
            "spatial_relevance": relevance_signals.get("spatial", 0.0),
            "situational_relevance": relevance_signals.get("situational", 0.0),
        },
        "available_context": [
            {
                "type": ctx.context_type.value,
                "key": ctx.key,
                "confidence": ctx.confidence,
                "would_include": ctx.confidence >= 0.5 and relevance_signals.get(ctx.context_type.value, 0) >= 0.2,
            }
            for ctx in contexts
        ],
        "estimated_tokens": sum(30 for ctx in contexts if ctx.confidence >= 0.5),
    }
    
    return preview


@router.post("/format")
async def format_for_provider(
    system_context: str,
    user_message: str,
    provider: str = "openai",
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    """
    Format a composed prompt for a specific provider.
    
    Takes already composed context and formats it according to
    the target provider's expected format.
    """
    # Provider-specific formatting would go here
    # For now, return a generic structure
    
    if provider == "openai":
        return {
            "messages": [
                {"role": "system", "content": system_context},
                {"role": "user", "content": user_message},
            ],
            "provider": "openai",
        }
    elif provider == "anthropic":
        return {
            "system": system_context,
            "messages": [
                {"role": "user", "content": user_message},
            ],
            "provider": "anthropic",
        }
    elif provider == "google":
        return {
            "system_instruction": system_context,
            "contents": [
                {"role": "user", "parts": [{"text": user_message}]},
            ],
            "provider": "google",
        }
    else:
        return {
            "system_context": system_context,
            "user_message": user_message,
            "provider": "generic",
        }
