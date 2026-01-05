"""
Authentication Schemas

Request and response schemas for authentication.
"""

from datetime import datetime
from typing import Optional

from pydantic import EmailStr, Field

from app.schemas.base import BaseSchema


class LoginRequest(BaseSchema):
    """Schema for login request."""
    
    email: EmailStr
    password: str = Field(min_length=8)


class TokenResponse(BaseSchema):
    """Schema for token response."""
    
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token expiry in seconds")
    refresh_expires_in: int = Field(description="Refresh token expiry in seconds")


class RefreshTokenRequest(BaseSchema):
    """Schema for token refresh request."""
    
    refresh_token: str


class APIKeyCreate(BaseSchema):
    """Schema for creating an API key."""
    
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    expires_at: Optional[datetime] = None


class APIKeyResponse(BaseSchema):
    """Schema for API key response."""
    
    id: str
    name: str
    key_prefix: str = Field(description="First 8 characters of key")
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    is_active: bool


class APIKeyCreatedResponse(APIKeyResponse):
    """Response when API key is created (includes full key)."""
    
    key: str = Field(description="Full API key (only shown once)")


class TenantCreate(BaseSchema):
    """Schema for creating a tenant."""
    
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(
        min_length=3,
        max_length=100,
        pattern=r"^[a-z0-9-]+$"
    )
    description: Optional[str] = None
    
    # Admin user
    admin_email: EmailStr
    admin_password: str = Field(min_length=8)


class TenantResponse(BaseSchema):
    """Schema for tenant response."""
    
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    
    # Limits
    max_users: int
    max_requests_per_minute: int
    
    # Stats
    user_count: int = 0
