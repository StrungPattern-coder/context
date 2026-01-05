"""
Context API Endpoints

Core API for context anchoring, retrieval, and management.
"""

from datetime import datetime, timezone
from typing import Any, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, TokenData
from app.models.context import Context, ContextType, MemoryTier, DriftStatus
from app.engines.temporal import TemporalEngine
from app.engines.spatial import SpatialEngine
from app.engines.situational import SituationalEngine
from app.engines.resolver import AssumptionResolver, ReferenceType
from app.engines.drift import DriftDetector
from app.services.context_memory import ContextMemoryService

router = APIRouter()

# Initialize engines
temporal_engine = TemporalEngine()
spatial_engine = SpatialEngine()
situational_engine = SituationalEngine()
assumption_resolver = AssumptionResolver(
    temporal_engine=temporal_engine,
    spatial_engine=spatial_engine,
)
drift_detector = DriftDetector()


# Request/Response Models

class ContextSignals(BaseModel):
    """Raw context signals from client."""
    timestamp: Optional[str] = Field(default=None, description="ISO 8601 timestamp")
    timezone: Optional[str] = Field(default=None, description="IANA timezone name")
    locale: Optional[str] = Field(default=None, description="Locale code (e.g., en-US)")
    country: Optional[str] = Field(default=None, description="ISO country code")
    region: Optional[str] = Field(default=None, description="Region/state")
    city: Optional[str] = Field(default=None, description="City name")
    session_id: Optional[str] = Field(default=None, description="Client session ID")
    device_type: Optional[str] = Field(default=None, description="Device type")
    custom: Optional[dict[str, Any]] = Field(default=None, description="Custom signals")


class AnchorRequest(BaseModel):
    """Request to anchor context for a user."""
    user_id: str = Field(description="User identifier")
    signals: ContextSignals = Field(default_factory=ContextSignals)
    message: Optional[str] = Field(default=None, description="User message for context")
    session_id: Optional[str] = Field(default=None, description="Session identifier")


class AnchorResponse(BaseModel):
    """Response with anchored context."""
    anchor_id: str
    user_id: str
    timestamp: datetime
    temporal: Optional[dict] = None
    spatial: Optional[dict] = None
    situational: Optional[dict] = None
    confidence: float
    warnings: list[str] = []


class ContextUpdateRequest(BaseModel):
    """Request to update specific context."""
    context_type: str = Field(description="Type: temporal, spatial, situational")
    key: str = Field(description="Context key to update")
    value: Any = Field(description="New value")
    source: str = Field(default="user", description="Source of update")
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class ContextResponse(BaseModel):
    """Single context element response."""
    id: str
    context_type: str
    key: str
    value: dict
    interpretation: Optional[dict]
    confidence: float
    source: str
    drift_status: str
    memory_tier: str
    created_at: datetime
    updated_at: datetime


class ResolveReferenceRequest(BaseModel):
    """Request to resolve an ambiguous reference."""
    reference: str = Field(description="The reference to resolve (e.g., 'today', 'here')")
    message_context: Optional[str] = Field(default=None, description="Surrounding message")


class ResolvedReference(BaseModel):
    """Resolved reference response."""
    original: str
    resolved_value: Any
    resolution_type: str
    confidence: float
    explanation: str
    alternatives: list[dict] = []


# Endpoints

@router.post("/anchor", response_model=AnchorResponse)
async def anchor_context(
    request: AnchorRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnchorResponse:
    """
    Anchor context for a user interaction.
    
    Processes raw signals and creates interpreted context that can be
    used for prompt composition. This is the primary entry point for
    context grounding.
    """
    anchor_id = str(uuid.uuid4())
    warnings = []
    
    # Process temporal context
    temporal_context = None
    if request.signals.timestamp or request.signals.timezone:
        try:
            # Parse timestamp string to datetime if provided
            ts = datetime.fromisoformat(request.signals.timestamp) if request.signals.timestamp else datetime.now(timezone.utc)
            temporal_interpretation = temporal_engine.interpret(
                timestamp=ts,
                timezone=request.signals.timezone,
            )
            temporal_context = temporal_interpretation.model_dump()
        except Exception as e:
            warnings.append(f"Temporal processing warning: {str(e)}")
    else:
        # Use current time as default
        temporal_interpretation = temporal_engine.interpret(timestamp=datetime.now(timezone.utc))
        temporal_context = temporal_interpretation.model_dump()
    
    # Process spatial context
    spatial_context = None
    if any([request.signals.locale, request.signals.country, request.signals.region]):
        try:
            spatial_interpretation = spatial_engine.interpret(
                locale=request.signals.locale,
                country=request.signals.country,
                region=request.signals.region,
                timezone=request.signals.timezone,
            )
            spatial_context = spatial_interpretation.model_dump()
        except Exception as e:
            warnings.append(f"Spatial processing warning: {str(e)}")
    
    # Process situational context
    situational_context = None
    if request.message:
        try:
            situational_interpretation = situational_engine.interpret(
                user_id=request.user_id,
                message=request.message,
                session_id=request.session_id,
            )
            situational_context = situational_interpretation.to_dict()
        except Exception as e:
            warnings.append(f"Situational processing warning: {str(e)}")
    
    # Calculate overall confidence
    confidences = []
    if temporal_context and "confidence" in temporal_context:
        confidences.append(temporal_context["confidence"].get("score", 0.5))
    if spatial_context and "confidence" in spatial_context:
        confidences.append(spatial_context["confidence"].get("score", 0.5))
    if situational_context and "confidence" in situational_context:
        confidences.append(situational_context["confidence"].get("score", 0.5))
    
    overall_confidence = sum(confidences) / len(confidences) if confidences else 0.5
    
    # Store context in database
    memory_service = ContextMemoryService(db)
    
    if temporal_context:
        await memory_service.store(
            user_id=uuid.UUID(request.user_id) if len(request.user_id) == 36 else uuid.uuid4(),
            context_type=ContextType.TEMPORAL,
            key="temporal_anchor",
            value=temporal_context,
            confidence=temporal_context.get("confidence", {}).get("score", 0.5),
            session_id=request.session_id,
        )
    
    return AnchorResponse(
        anchor_id=anchor_id,
        user_id=request.user_id,
        timestamp=datetime.now(timezone.utc),
        temporal=temporal_context,
        spatial=spatial_context,
        situational=situational_context,
        confidence=overall_confidence,
        warnings=warnings,
    )


@router.get("/{user_id}", response_model=dict)
async def get_user_context(
    user_id: str,
    context_type: Optional[str] = Query(default=None, description="Filter by type"),
    include_expired: bool = Query(default=False, description="Include expired context"),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Retrieve all context for a user.
    
    Returns the current state of all context elements for the specified user.
    """
    # Build query
    conditions = [Context.is_active == True]
    
    # Try to parse user_id as UUID, otherwise use external_id lookup
    try:
        user_uuid = uuid.UUID(user_id)
        conditions.append(Context.user_id == user_uuid)
    except ValueError:
        # Would need to look up by external_id
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format",
        )
    
    if context_type:
        try:
            ct = ContextType(context_type)
            conditions.append(Context.context_type == ct)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid context type: {context_type}",
            )
    
    if not include_expired:
        conditions.append(
            (Context.expires_at == None) | (Context.expires_at > datetime.now(timezone.utc))
        )
    
    result = await db.execute(
        select(Context).where(and_(*conditions)).order_by(Context.updated_at.desc())
    )
    contexts = result.scalars().all()
    
    # Group by type
    grouped = {
        "temporal": [],
        "spatial": [],
        "situational": [],
        "meta": [],
    }
    
    for ctx in contexts:
        grouped[ctx.context_type.value].append({
            "id": str(ctx.id),
            "key": ctx.key,
            "value": ctx.value,
            "interpretation": ctx.interpretation,
            "confidence": ctx.confidence,
            "source": ctx.source,
            "drift_status": ctx.drift_status.value,
            "memory_tier": ctx.memory_tier.value,
            "updated_at": ctx.updated_at.isoformat(),
        })
    
    return {
        "user_id": user_id,
        "context": grouped,
        "total_elements": len(contexts),
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/update", response_model=ContextResponse)
async def update_context(
    request: ContextUpdateRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContextResponse:
    """
    Update or create a specific context element.
    
    Allows explicit context updates from users or applications.
    """
    try:
        context_type = ContextType(request.context_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid context type: {request.context_type}",
        )
    
    memory_service = ContextMemoryService(db)
    
    context = await memory_service.store(
        user_id=uuid.UUID(current_user.user_id),
        context_type=context_type,
        key=request.key,
        value={"value": request.value} if not isinstance(request.value, dict) else request.value,
        confidence=request.confidence or 0.9,  # High confidence for explicit updates
        source=request.source,
    )
    
    return ContextResponse(
        id=str(context.id),
        context_type=context.context_type.value,
        key=context.key,
        value=context.value,
        interpretation=context.interpretation,
        confidence=context.confidence,
        source=context.source,
        drift_status=context.drift_status.value,
        memory_tier=context.memory_tier.value,
        created_at=context.created_at,
        updated_at=context.updated_at,
    )


@router.delete("/{context_id}")
async def delete_context(
    context_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Delete a specific context element.
    
    Soft deletes the context, maintaining history.
    """
    try:
        ctx_uuid = uuid.UUID(context_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid context ID format",
        )
    
    result = await db.execute(
        select(Context).where(Context.id == ctx_uuid)
    )
    context = result.scalar_one_or_none()
    
    if not context:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Context not found",
        )
    
    # Soft delete
    context.is_active = False
    context.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    
    return {"message": "Context deleted", "id": context_id}


@router.post("/resolve", response_model=ResolvedReference)
async def resolve_reference(
    request: ResolveReferenceRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ResolvedReference:
    """
    Resolve an ambiguous reference.
    
    Takes references like "today", "now", "here" and resolves them
    to concrete values based on the user's context.
    """
    # Get user's current context
    result = await db.execute(
        select(Context).where(
            Context.user_id == uuid.UUID(current_user.user_id),
            Context.is_active == True,
        )
    )
    contexts = result.scalars().all()
    
    # Build context dict for resolver
    context_dict = {}
    for ctx in contexts:
        if ctx.context_type.value not in context_dict:
            context_dict[ctx.context_type.value] = {}
        context_dict[ctx.context_type.value][ctx.key] = ctx.value
    
    # Resolve using the assumption resolver
    # Detect reference type first
    references = assumption_resolver.detect_references(request.reference)
    ref_type = references[0][1] if references else ReferenceType.UNKNOWN
    
    resolution = assumption_resolver.resolve(
        reference=request.reference,
        reference_type=ref_type,
        temporal_context=context_dict.get("temporal"),
        spatial_context=context_dict.get("spatial"),
        conversation_history=None,
    )
    
    return ResolvedReference(
        original=request.reference,
        resolved_value=resolution.resolved_value,
        resolution_type=resolution.reference_type.value,
        confidence=resolution.confidence,
        explanation=resolution.reasoning,
        alternatives=[{
            "value": c.value,
            "confidence": c.confidence,
            "method": c.method
        } for c in resolution.alternative_candidates],
    )


@router.post("/confirm/{context_id}")
async def confirm_context(
    context_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Confirm that a context element is correct.
    
    Increases confidence and resets drift status.
    """
    try:
        ctx_uuid = uuid.UUID(context_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid context ID format",
        )
    
    result = await db.execute(
        select(Context).where(Context.id == ctx_uuid)
    )
    context = result.scalar_one_or_none()
    
    if not context:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Context not found",
        )
    
    context.confirm()
    await db.commit()
    
    return {
        "message": "Context confirmed",
        "id": context_id,
        "new_confidence": context.confidence,
        "drift_status": context.drift_status.value,
    }


@router.post("/correct/{context_id}")
async def correct_context(
    context_id: str,
    new_value: dict,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Record a correction to context.
    
    Updates the context and records that a correction was made,
    which affects drift detection.
    """
    try:
        ctx_uuid = uuid.UUID(context_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid context ID format",
        )
    
    memory_service = ContextMemoryService(db)
    
    result = await db.execute(
        select(Context).where(Context.id == ctx_uuid)
    )
    context = result.scalar_one_or_none()
    
    if not context:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Context not found",
        )
    
    # Update context (this creates version history internally)
    await memory_service.update(
        context_id=ctx_uuid,
        value=new_value,
        source="user_correction",
        change_reason="User correction",
    )
    
    # Record correction
    context.record_correction()
    await db.commit()
    
    # Check for drift
    drift_signals = drift_detector.check_single(context)
    drift_warning = drift_signals[0].description if drift_signals else None
    
    return {
        "message": "Context corrected",
        "id": context_id,
        "new_confidence": context.confidence,
        "correction_count": context.correction_count,
        "drift_status": context.drift_status.value,
        "drift_warning": drift_warning,
    }
