"""
Security and Authentication Utilities

Provides JWT token generation/validation, password hashing,
and authentication dependencies for FastAPI.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token security scheme
bearer_scheme = HTTPBearer(auto_error=False)


class TokenPayload(BaseModel):
    """JWT token payload structure."""
    sub: str  # Subject (user_id)
    tenant_id: str
    exp: datetime
    iat: datetime
    type: str  # "access" or "refresh"


class TokenData(BaseModel):
    """Extracted token data for use in endpoints."""
    user_id: str
    tenant_id: str


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    
    Args:
        plain_password: Plain text password
        hashed_password: Bcrypt hashed password
        
    Returns:
        True if password matches
    """
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Args:
        password: Plain text password
        
    Returns:
        Bcrypt hash of password
    """
    return pwd_context.hash(password)


def create_access_token(
    user_id: str,
    tenant_id: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a JWT access token.
    
    Args:
        user_id: User identifier
        tenant_id: Tenant identifier
        expires_delta: Optional custom expiry time
        
    Returns:
        Encoded JWT token
    """
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    
    payload = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "exp": expire,
        "iat": now,
        "type": "access",
    }
    
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: str, tenant_id: str) -> str:
    """
    Create a JWT refresh token.
    
    Args:
        user_id: User identifier
        tenant_id: Tenant identifier
        
    Returns:
        Encoded JWT refresh token
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    payload = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "exp": expire,
        "iat": now,
        "type": "refresh",
    }
    
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> TokenPayload:
    """
    Decode and validate a JWT token.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded token payload
        
    Raises:
        JWTError: If token is invalid or expired
    """
    payload = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
    )
    return TokenPayload(**payload)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> TokenData:
    """
    FastAPI dependency to get current authenticated user.
    
    Args:
        credentials: Bearer token credentials
        db: Database session
        
    Returns:
        Token data with user_id and tenant_id
        
    Raises:
        HTTPException: If authentication fails
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        payload = decode_token(credentials.credentials)
        
        if payload.type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        
        return TokenData(
            user_id=payload.sub,
            tenant_id=payload.tenant_id,
        )
        
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[TokenData]:
    """
    FastAPI dependency to optionally get current user.
    
    Returns None if not authenticated instead of raising exception.
    
    Args:
        credentials: Bearer token credentials
        
    Returns:
        Token data or None
    """
    if not credentials:
        return None
    
    try:
        payload = decode_token(credentials.credentials)
        
        if payload.type != "access":
            return None
        
        return TokenData(
            user_id=payload.sub,
            tenant_id=payload.tenant_id,
        )
        
    except JWTError:
        return None


def generate_api_key() -> str:
    """
    Generate a secure API key.
    
    Returns:
        Random 32-character API key
    """
    import secrets
    return secrets.token_urlsafe(32)


# Alias for v0 API compatibility
get_current_user_optional = get_optional_user
