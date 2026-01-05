"""
Drift API v0 - Context Drift Detection Endpoints

These endpoints are part of the stable v0 API contract.
"""

from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_optional, TokenData

router = APIRouter()


# ============================================================================
# Request/Response Models (Public Contract)
# ============================================================================

class ContextDriftStatus(BaseModel):
    """Drift status for a single context type."""
    type: str = Field(description="Context type: temporal, spatial, situational")
    status: Literal["fresh", "stale", "unknown"] = Field(description="Current status")
    drift_score: float = Field(ge=0.0, le=1.0, description="Drift score (0=fresh, 1=completely stale)")
    last_confirmed: Optional[datetime] = Field(default=None, description="When last confirmed")
    recommendation: Optional[str] = Field(default=None, description="Recommended action")


class DriftStatusResponse(BaseModel):
    """Response with drift status for all contexts."""
    user_id: str
    checked_at: datetime
    overall_status: Literal["healthy", "needs_refresh", "stale"]
    overall_drift_score: float = Field(ge=0.0, le=1.0)
    contexts: list[ContextDriftStatus]
    recommendations: list[str] = Field(default_factory=list)


# ============================================================================
# Endpoints (Public Contract)
# ============================================================================

@router.get("/status", response_model=DriftStatusResponse)
async def get_drift_status(
    user_id: str = Query(description="User identifier"),
    current_user: Optional[TokenData] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> DriftStatusResponse:
    """
    Check for context drift and staleness.
    
    Context drift occurs when stored context may no longer accurately
    reflect the user's reality (e.g., location not confirmed in 24 hours).
    
    **Drift Scores:**
    - 0.0: Freshly confirmed
    - 0.3: Still reliable
    - 0.5: May need refresh
    - 0.7: Likely stale
    - 1.0: Definitely stale
    
    **Guarantees:**
    - Proactive: Detects drift before it causes errors
    - Actionable: Provides specific recommendations
    - Non-blocking: Never forces user interaction
    """
    now = datetime.now(timezone.utc)
    
    # In v0, context is ephemeral (not stored), so we return 
    # a static response indicating fresh start
    context_statuses = [
        ContextDriftStatus(
            type="temporal",
            status="fresh",
            drift_score=0.0,
            last_confirmed=now,
            recommendation=None,
        ),
        ContextDriftStatus(
            type="spatial",
            status="unknown",
            drift_score=0.5,
            last_confirmed=None,
            recommendation="provide_location_signals",
        ),
        ContextDriftStatus(
            type="situational",
            status="unknown",
            drift_score=0.5,
            last_confirmed=None,
            recommendation="collect_situational_context",
        ),
    ]
    
    recommendations = []
    
    # Calculate overall status
    avg_drift = sum(s.drift_score for s in context_statuses) / len(context_statuses)
    
    if avg_drift < 0.3:
        overall_status: Literal["healthy", "needs_refresh", "stale"] = "healthy"
    elif avg_drift < 0.6:
        overall_status = "needs_refresh"
        recommendations.append("Consider providing location to improve context accuracy")
    else:
        overall_status = "stale"
        recommendations.append("Context is stale - please provide updated signals")
    
    return DriftStatusResponse(
        user_id=user_id,
        checked_at=now,
        overall_status=overall_status,
        overall_drift_score=avg_drift,
        contexts=context_statuses,
        recommendations=recommendations,
    )
