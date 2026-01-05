"""
Users API Endpoints

User management and preferences API.
"""

from datetime import datetime, timezone
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, TokenData
from app.models.user import User

router = APIRouter()


# Request/Response Models

class UserPreferencesUpdate(BaseModel):
    """User preferences update request."""
    default_timezone: Optional[str] = None
    default_locale: Optional[str] = None
    default_country: Optional[str] = None
    allow_location_tracking: Optional[bool] = None
    allow_situational_tracking: Optional[bool] = None
    preferences: Optional[dict] = None


class UserPreferencesResponse(BaseModel):
    """User preferences response."""
    default_timezone: Optional[str]
    default_locale: Optional[str]
    default_country: Optional[str]
    allow_location_tracking: bool
    allow_situational_tracking: bool
    preferences: dict
    updated_at: datetime


class UserProfileResponse(BaseModel):
    """Full user profile response."""
    id: str
    external_id: str
    email: Optional[str]
    display_name: Optional[str]
    tenant_id: str
    default_timezone: Optional[str]
    default_locale: Optional[str]
    default_country: Optional[str]
    allow_location_tracking: bool
    allow_situational_tracking: bool
    preferences: dict
    is_active: bool
    created_at: datetime
    updated_at: datetime


# Endpoints

@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """
    Get current user's full profile.
    """
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(current_user.user_id))
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return UserProfileResponse(
        id=str(user.id),
        external_id=user.external_id,
        email=user.email,
        display_name=user.display_name,
        tenant_id=str(user.tenant_id),
        default_timezone=user.default_timezone,
        default_locale=user.default_locale,
        default_country=user.default_country,
        allow_location_tracking=user.allow_location_tracking,
        allow_situational_tracking=user.allow_situational_tracking,
        preferences=user.preferences,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("/preferences", response_model=UserPreferencesResponse)
async def get_preferences(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserPreferencesResponse:
    """
    Get current user's context preferences.
    """
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(current_user.user_id))
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return UserPreferencesResponse(
        default_timezone=user.default_timezone,
        default_locale=user.default_locale,
        default_country=user.default_country,
        allow_location_tracking=user.allow_location_tracking,
        allow_situational_tracking=user.allow_situational_tracking,
        preferences=user.preferences,
        updated_at=user.updated_at,
    )


@router.put("/preferences", response_model=UserPreferencesResponse)
async def update_preferences(
    request: UserPreferencesUpdate,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserPreferencesResponse:
    """
    Update current user's context preferences.
    
    Only provided fields will be updated.
    """
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(current_user.user_id))
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Update only provided fields
    if request.default_timezone is not None:
        user.default_timezone = request.default_timezone
    if request.default_locale is not None:
        user.default_locale = request.default_locale
    if request.default_country is not None:
        user.default_country = request.default_country
    if request.allow_location_tracking is not None:
        user.allow_location_tracking = request.allow_location_tracking
    if request.allow_situational_tracking is not None:
        user.allow_situational_tracking = request.allow_situational_tracking
    if request.preferences is not None:
        user.preferences = {**user.preferences, **request.preferences}
    
    await db.commit()
    await db.refresh(user)
    
    return UserPreferencesResponse(
        default_timezone=user.default_timezone,
        default_locale=user.default_locale,
        default_country=user.default_country,
        allow_location_tracking=user.allow_location_tracking,
        allow_situational_tracking=user.allow_situational_tracking,
        preferences=user.preferences,
        updated_at=user.updated_at,
    )


@router.put("/profile")
async def update_profile(
    display_name: Optional[str] = None,
    email: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """
    Update current user's profile.
    """
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(current_user.user_id))
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    if display_name is not None:
        user.display_name = display_name
    if email is not None:
        user.email = email
    
    await db.commit()
    await db.refresh(user)
    
    return UserProfileResponse(
        id=str(user.id),
        external_id=user.external_id,
        email=user.email,
        display_name=user.display_name,
        tenant_id=str(user.tenant_id),
        default_timezone=user.default_timezone,
        default_locale=user.default_locale,
        default_country=user.default_country,
        allow_location_tracking=user.allow_location_tracking,
        allow_situational_tracking=user.allow_situational_tracking,
        preferences=user.preferences,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.delete("/account")
async def delete_account(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Delete current user's account.
    
    This is a soft delete that deactivates the account.
    """
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(current_user.user_id))
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    user.is_active = False
    user.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    
    return {"message": "Account deleted successfully"}


@router.post("/export")
async def export_user_data(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Export all user data (GDPR compliance).
    
    Returns all data associated with the user.
    """
    from app.models.context import Context
    
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(current_user.user_id))
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Get all contexts
    context_result = await db.execute(
        select(Context).where(Context.user_id == user.id)
    )
    contexts = context_result.scalars().all()
    
    return {
        "user": {
            "id": str(user.id),
            "external_id": user.external_id,
            "email": user.email,
            "display_name": user.display_name,
            "preferences": user.preferences,
            "created_at": user.created_at.isoformat(),
        },
        "contexts": [
            {
                "type": ctx.context_type.value,
                "key": ctx.key,
                "value": ctx.value,
                "confidence": ctx.confidence,
                "created_at": ctx.created_at.isoformat(),
            }
            for ctx in contexts
        ],
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }
