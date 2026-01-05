"""
Authentication API Endpoints

Handles user authentication, token management, and API key operations.
"""

from datetime import datetime, timezone
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
    generate_api_key,
    get_current_user,
    TokenData,
)
from app.models.user import User
from app.models.tenant import Tenant

router = APIRouter()


# Request/Response Models

class RegisterRequest(BaseModel):
    """User registration request."""
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: Optional[str] = None
    tenant_slug: str = Field(description="Tenant identifier")
    external_id: Optional[str] = Field(default=None, description="Optional external ID")


class LoginRequest(BaseModel):
    """User login request."""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Authentication token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    """Token refresh request."""
    refresh_token: str


class APIKeyResponse(BaseModel):
    """API key response."""
    api_key: str
    created_at: datetime
    name: Optional[str] = None


class UserResponse(BaseModel):
    """User information response."""
    id: str
    email: Optional[str]
    display_name: Optional[str]
    tenant_id: str
    external_id: str
    created_at: datetime


# Endpoints

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Register a new user.
    
    Creates a new user account within the specified tenant.
    """
    # Find tenant
    result = await db.execute(
        select(Tenant).where(Tenant.slug == request.tenant_slug)
    )
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant '{request.tenant_slug}' not found",
        )
    
    # Check if email already exists
    result = await db.execute(
        select(User).where(
            User.email == request.email,
            User.tenant_id == tenant.id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    # Create user
    user = User(
        external_id=request.external_id or str(uuid.uuid4()),
        tenant_id=tenant.id,
        email=request.email,
        password_hash=hash_password(request.password),
        display_name=request.display_name,
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        tenant_id=str(user.tenant_id),
        external_id=user.external_id,
        created_at=user.created_at,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Authenticate user and return tokens.
    
    Returns JWT access and refresh tokens for authenticated users.
    """
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    user = result.scalar_one_or_none()
    
    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )
    
    # Generate tokens
    access_token = create_access_token(str(user.id), str(user.tenant_id))
    refresh_token = create_refresh_token(str(user.id), str(user.tenant_id))
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=30 * 60,  # 30 minutes
    )


@router.post("/token", response_model=TokenResponse)
async def token_oauth2(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    OAuth2 compatible token endpoint.
    
    Standard OAuth2 password flow for tool compatibility.
    """
    request = LoginRequest(email=form_data.username, password=form_data.password)
    return await login(request, db)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Refresh access token using refresh token.
    """
    try:
        payload = decode_token(request.refresh_token)
        
        if payload.type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        
        # Verify user still exists and is active
        result = await db.execute(
            select(User).where(User.id == uuid.UUID(payload.sub))
        )
        user = result.scalar_one_or_none()
        
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )
        
        # Generate new tokens
        access_token = create_access_token(str(user.id), str(user.tenant_id))
        new_refresh_token = create_refresh_token(str(user.id), str(user.tenant_id))
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            expires_in=30 * 60,
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid refresh token: {str(e)}",
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Get current authenticated user information.
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
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        tenant_id=str(user.tenant_id),
        external_id=user.external_id,
        created_at=user.created_at,
    )


@router.post("/api-key", response_model=APIKeyResponse)
async def create_api_key(
    name: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user),
) -> APIKeyResponse:
    """
    Generate a new API key for the current user.
    
    API keys can be used for server-to-server authentication.
    """
    api_key = generate_api_key()
    
    # In production, this would be stored in the database
    # associated with the user
    
    return APIKeyResponse(
        api_key=api_key,
        created_at=datetime.now(timezone.utc),
        name=name,
    )


@router.post("/logout")
async def logout(
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    """
    Logout current user.
    
    In a production system, this would invalidate the token.
    """
    # Token invalidation would be implemented here
    # (e.g., adding to a blacklist in Redis)
    
    return {"message": "Successfully logged out"}
