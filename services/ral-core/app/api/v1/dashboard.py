"""
Dashboard API Endpoints

API for the user control dashboard - context visibility and management.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, TokenData
from app.models.context import Context, ContextType, ContextVersion, DriftStatus
from app.models.user import User

router = APIRouter()


# Response Models

class ContextSummary(BaseModel):
    """Summary of context state."""
    total_elements: int
    by_type: dict[str, int]
    by_confidence: dict[str, int]
    by_drift_status: dict[str, int]
    oldest_element: Optional[datetime]
    newest_element: Optional[datetime]


class ContextElementDetail(BaseModel):
    """Detailed context element for dashboard."""
    id: str
    context_type: str
    key: str
    value: dict
    interpretation: Optional[dict]
    confidence: float
    confidence_level: str
    source: str
    drift_status: str
    memory_tier: str
    session_id: Optional[str]
    last_confirmed_at: Optional[datetime]
    correction_count: int
    created_at: datetime
    updated_at: datetime
    is_expired: bool


class ContextHistory(BaseModel):
    """Context version history."""
    context_id: str
    current_value: dict
    versions: list[dict]
    total_changes: int


class DriftReport(BaseModel):
    """Drift analysis report."""
    user_id: str
    analysis_time: datetime
    total_contexts: int
    stable_count: int
    drifting_count: int
    conflicting_count: int
    stale_count: int
    recommendations: list[str]


# Endpoints

@router.get("/summary", response_model=ContextSummary)
async def get_context_summary(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContextSummary:
    """
    Get summary of user's context state.
    
    Provides an overview of all context elements for the dashboard.
    """
    user_uuid = uuid.UUID(current_user.user_id)
    
    # Get all active contexts
    result = await db.execute(
        select(Context).where(
            Context.user_id == user_uuid,
            Context.is_active == True,
        )
    )
    contexts = result.scalars().all()
    
    # Calculate summaries
    by_type = {}
    by_confidence = {"high": 0, "medium": 0, "low": 0}
    by_drift_status = {}
    
    oldest = None
    newest = None
    
    for ctx in contexts:
        # By type
        type_key = ctx.context_type.value
        by_type[type_key] = by_type.get(type_key, 0) + 1
        
        # By confidence
        if ctx.confidence >= 0.8:
            by_confidence["high"] += 1
        elif ctx.confidence >= 0.5:
            by_confidence["medium"] += 1
        else:
            by_confidence["low"] += 1
        
        # By drift status
        drift_key = ctx.drift_status.value
        by_drift_status[drift_key] = by_drift_status.get(drift_key, 0) + 1
        
        # Track oldest/newest
        if oldest is None or ctx.created_at < oldest:
            oldest = ctx.created_at
        if newest is None or ctx.updated_at > newest:
            newest = ctx.updated_at
    
    return ContextSummary(
        total_elements=len(contexts),
        by_type=by_type,
        by_confidence=by_confidence,
        by_drift_status=by_drift_status,
        oldest_element=oldest,
        newest_element=newest,
    )


@router.get("/contexts", response_model=list[ContextElementDetail])
async def list_contexts(
    context_type: Optional[str] = Query(default=None),
    drift_status: Optional[str] = Query(default=None),
    min_confidence: Optional[float] = Query(default=None, ge=0.0, le=1.0),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ContextElementDetail]:
    """
    List all context elements with filtering.
    
    Provides detailed view of context for user inspection.
    """
    user_uuid = uuid.UUID(current_user.user_id)
    
    # Build conditions
    conditions = [
        Context.user_id == user_uuid,
        Context.is_active == True,
    ]
    
    if context_type:
        try:
            conditions.append(Context.context_type == ContextType(context_type))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid context type: {context_type}",
            )
    
    if drift_status:
        try:
            conditions.append(Context.drift_status == DriftStatus(drift_status))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid drift status: {drift_status}",
            )
    
    if min_confidence is not None:
        conditions.append(Context.confidence >= min_confidence)
    
    result = await db.execute(
        select(Context)
        .where(and_(*conditions))
        .order_by(Context.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    contexts = result.scalars().all()
    
    return [
        ContextElementDetail(
            id=str(ctx.id),
            context_type=ctx.context_type.value,
            key=ctx.key,
            value=ctx.value,
            interpretation=ctx.interpretation,
            confidence=ctx.confidence,
            confidence_level="high" if ctx.confidence >= 0.8 else "medium" if ctx.confidence >= 0.5 else "low",
            source=ctx.source,
            drift_status=ctx.drift_status.value,
            memory_tier=ctx.memory_tier.value,
            session_id=ctx.session_id,
            last_confirmed_at=ctx.last_confirmed_at,
            correction_count=ctx.correction_count,
            created_at=ctx.created_at,
            updated_at=ctx.updated_at,
            is_expired=ctx.is_expired,
        )
        for ctx in contexts
    ]


@router.get("/context/{context_id}", response_model=ContextElementDetail)
async def get_context_detail(
    context_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContextElementDetail:
    """
    Get detailed information about a specific context element.
    """
    try:
        ctx_uuid = uuid.UUID(context_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid context ID format",
        )
    
    result = await db.execute(
        select(Context).where(
            Context.id == ctx_uuid,
            Context.user_id == uuid.UUID(current_user.user_id),
        )
    )
    ctx = result.scalar_one_or_none()
    
    if not ctx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Context not found",
        )
    
    return ContextElementDetail(
        id=str(ctx.id),
        context_type=ctx.context_type.value,
        key=ctx.key,
        value=ctx.value,
        interpretation=ctx.interpretation,
        confidence=ctx.confidence,
        confidence_level="high" if ctx.confidence >= 0.8 else "medium" if ctx.confidence >= 0.5 else "low",
        source=ctx.source,
        drift_status=ctx.drift_status.value,
        memory_tier=ctx.memory_tier.value,
        session_id=ctx.session_id,
        last_confirmed_at=ctx.last_confirmed_at,
        correction_count=ctx.correction_count,
        created_at=ctx.created_at,
        updated_at=ctx.updated_at,
        is_expired=ctx.is_expired,
    )


@router.get("/history/{context_id}", response_model=ContextHistory)
async def get_context_history(
    context_id: str,
    limit: int = Query(default=20, le=100),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContextHistory:
    """
    Get version history for a context element.
    
    Shows how context has changed over time.
    """
    try:
        ctx_uuid = uuid.UUID(context_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid context ID format",
        )
    
    # Get current context
    result = await db.execute(
        select(Context).where(
            Context.id == ctx_uuid,
            Context.user_id == uuid.UUID(current_user.user_id),
        )
    )
    ctx = result.scalar_one_or_none()
    
    if not ctx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Context not found",
        )
    
    # Get versions
    version_result = await db.execute(
        select(ContextVersion)
        .where(ContextVersion.context_id == ctx_uuid)
        .order_by(ContextVersion.version.desc())
        .limit(limit)
    )
    versions = version_result.scalars().all()
    
    return ContextHistory(
        context_id=context_id,
        current_value=ctx.value,
        versions=[
            {
                "version": v.version,
                "value": v.value,
                "confidence": v.confidence,
                "changed_by": v.changed_by,
                "change_reason": v.change_reason,
                "created_at": v.created_at.isoformat(),
            }
            for v in versions
        ],
        total_changes=len(versions),
    )


@router.get("/drift-report", response_model=DriftReport)
async def get_drift_report(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DriftReport:
    """
    Get drift analysis report.
    
    Analyzes context health and provides recommendations.
    """
    user_uuid = uuid.UUID(current_user.user_id)
    
    result = await db.execute(
        select(Context).where(
            Context.user_id == user_uuid,
            Context.is_active == True,
        )
    )
    contexts = result.scalars().all()
    
    # Count by drift status
    stable = sum(1 for c in contexts if c.drift_status == DriftStatus.STABLE)
    drifting = sum(1 for c in contexts if c.drift_status == DriftStatus.DRIFTING)
    conflicting = sum(1 for c in contexts if c.drift_status == DriftStatus.CONFLICTING)
    stale = sum(1 for c in contexts if c.drift_status == DriftStatus.STALE)
    
    # Generate recommendations
    recommendations = []
    
    if conflicting > 0:
        recommendations.append(
            f"You have {conflicting} context element(s) with conflicts. "
            "Review and confirm the correct values."
        )
    
    if stale > 0:
        recommendations.append(
            f"You have {stale} stale context element(s). "
            "Consider updating or removing outdated information."
        )
    
    # Check for low confidence contexts
    low_confidence = sum(1 for c in contexts if c.confidence < 0.5)
    if low_confidence > 0:
        recommendations.append(
            f"{low_confidence} context element(s) have low confidence. "
            "Confirming these will improve AI accuracy."
        )
    
    # Check for contexts with many corrections
    high_corrections = sum(1 for c in contexts if c.correction_count >= 3)
    if high_corrections > 0:
        recommendations.append(
            f"{high_corrections} context element(s) have been corrected multiple times. "
            "Consider reviewing your default settings."
        )
    
    if not recommendations:
        recommendations.append("Your context is healthy! No issues detected.")
    
    return DriftReport(
        user_id=current_user.user_id,
        analysis_time=datetime.now(timezone.utc),
        total_contexts=len(contexts),
        stable_count=stable,
        drifting_count=drifting,
        conflicting_count=conflicting,
        stale_count=stale,
        recommendations=recommendations,
    )


@router.delete("/clear")
async def clear_all_context(
    context_type: Optional[str] = Query(default=None),
    confirm: bool = Query(default=False),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Clear all context for the user.
    
    Requires confirmation. Optionally filter by context type.
    """
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Set confirm=true to clear context",
        )
    
    user_uuid = uuid.UUID(current_user.user_id)
    
    conditions = [
        Context.user_id == user_uuid,
        Context.is_active == True,
    ]
    
    if context_type:
        try:
            conditions.append(Context.context_type == ContextType(context_type))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid context type: {context_type}",
            )
    
    result = await db.execute(
        select(Context).where(and_(*conditions))
    )
    contexts = result.scalars().all()
    
    count = 0
    for ctx in contexts:
        ctx.is_active = False
        ctx.deleted_at = datetime.now(timezone.utc)
        count += 1
    
    await db.commit()
    
    return {
        "message": f"Cleared {count} context element(s)",
        "cleared_count": count,
        "context_type": context_type,
    }


@router.post("/refresh")
async def refresh_context(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Refresh and recalculate all context.
    
    Re-runs interpretation on stored context values.
    """
    from app.engines.temporal import TemporalEngine
    from app.engines.drift import DriftDetector
    
    user_uuid = uuid.UUID(current_user.user_id)
    
    result = await db.execute(
        select(Context).where(
            Context.user_id == user_uuid,
            Context.is_active == True,
        )
    )
    contexts = result.scalars().all()
    
    drift_detector = DriftDetector()
    refreshed = 0
    
    for ctx in contexts:
        # Run drift detection
        drift_signals = drift_detector.check_single(ctx)
        if drift_signals:
            # Update drift status based on signals
            ctx.drift_status = DriftStatus.DRIFTING
        
        # Apply decay if needed
        hours_since_update = (datetime.now(timezone.utc) - ctx.updated_at).total_seconds() / 3600
        if hours_since_update > 24:
            ctx.decay_confidence(0.95)  # Slight decay
        
        refreshed += 1
    
    await db.commit()
    
    return {
        "message": f"Refreshed {refreshed} context element(s)",
        "refreshed_count": refreshed,
    }
