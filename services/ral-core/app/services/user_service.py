"""
User Service

Business logic for user management operations.
"""

from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext

from app.models.user import User
from app.models.tenant import Tenant

logger = structlog.get_logger()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserService:
    """
    Service for user management operations.
    
    Handles user creation, authentication, and profile management.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        """Get a user by their ID."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """Get a user by their email address."""
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def get_by_external_id(
        self,
        external_id: str,
        tenant_id: UUID,
    ) -> Optional[User]:
        """Get a user by their external ID within a tenant."""
        result = await self.db.execute(
            select(User).where(
                and_(
                    User.external_id == external_id,
                    User.tenant_id == tenant_id,
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def create(
        self,
        tenant_id: UUID,
        external_id: str,
        email: Optional[str] = None,
        password: Optional[str] = None,
        display_name: Optional[str] = None,
        preferences: Optional[dict] = None,
        default_timezone: Optional[str] = None,
        default_locale: Optional[str] = None,
    ) -> User:
        """
        Create a new user.
        
        Args:
            tenant_id: Parent tenant ID
            external_id: Client-provided user identifier
            email: Optional email for authentication
            password: Optional password (will be hashed)
            display_name: Optional display name
            preferences: Optional user preferences
            default_timezone: Optional default timezone
            default_locale: Optional default locale
            
        Returns:
            Created user object
        """
        # Check if user already exists
        existing = await self.get_by_external_id(external_id, tenant_id)
        if existing:
            raise ValueError(f"User with external_id {external_id} already exists")
        
        if email:
            existing_email = await self.get_by_email(email)
            if existing_email:
                raise ValueError(f"User with email {email} already exists")
        
        # Hash password if provided
        password_hash = None
        if password:
            password_hash = pwd_context.hash(password)
        
        user = User(
            tenant_id=tenant_id,
            external_id=external_id,
            email=email,
            password_hash=password_hash,
            display_name=display_name,
            preferences=preferences or {},
            default_timezone=default_timezone,
            default_locale=default_locale,
        )
        
        self.db.add(user)
        await self.db.flush()
        
        logger.info(
            "User created",
            user_id=str(user.id),
            external_id=external_id,
            tenant_id=str(tenant_id),
        )
        
        return user
    
    async def authenticate(
        self,
        email: str,
        password: str,
    ) -> Optional[User]:
        """
        Authenticate a user by email and password.
        
        Args:
            email: User's email
            password: User's password
            
        Returns:
            User if authentication successful, None otherwise
        """
        user = await self.get_by_email(email)
        if not user:
            return None
        
        if not user.password_hash:
            return None
        
        if not pwd_context.verify(password, user.password_hash):
            return None
        
        if not user.is_active:
            return None
        
        logger.info("User authenticated", user_id=str(user.id))
        return user
    
    async def update(
        self,
        user_id: UUID,
        display_name: Optional[str] = None,
        preferences: Optional[dict] = None,
        default_timezone: Optional[str] = None,
        default_locale: Optional[str] = None,
    ) -> User:
        """
        Update a user's profile.
        
        Args:
            user_id: User to update
            display_name: New display name
            preferences: New preferences (merged with existing)
            default_timezone: New default timezone
            default_locale: New default locale
            
        Returns:
            Updated user object
        """
        user = await self.get_by_id(user_id)
        if not user:
            raise ValueError(f"User not found: {user_id}")
        
        if display_name is not None:
            user.display_name = display_name
        
        if preferences is not None:
            user.preferences = {**user.preferences, **preferences}
        
        if default_timezone is not None:
            user.default_timezone = default_timezone
        
        if default_locale is not None:
            user.default_locale = default_locale
        
        await self.db.flush()
        
        logger.info("User updated", user_id=str(user_id))
        return user
    
    async def change_password(
        self,
        user_id: UUID,
        new_password: str,
    ) -> bool:
        """
        Change a user's password.
        
        Args:
            user_id: User to update
            new_password: New password (will be hashed)
            
        Returns:
            True if successful
        """
        user = await self.get_by_id(user_id)
        if not user:
            raise ValueError(f"User not found: {user_id}")
        
        user.password_hash = pwd_context.hash(new_password)
        await self.db.flush()
        
        logger.info("User password changed", user_id=str(user_id))
        return True
    
    async def deactivate(self, user_id: UUID) -> bool:
        """
        Deactivate a user.
        
        Args:
            user_id: User to deactivate
            
        Returns:
            True if successful
        """
        user = await self.get_by_id(user_id)
        if not user:
            raise ValueError(f"User not found: {user_id}")
        
        user.is_active = False
        await self.db.flush()
        
        logger.info("User deactivated", user_id=str(user_id))
        return True
    
    async def activate(self, user_id: UUID) -> bool:
        """
        Activate a user.
        
        Args:
            user_id: User to activate
            
        Returns:
            True if successful
        """
        user = await self.get_by_id(user_id)
        if not user:
            raise ValueError(f"User not found: {user_id}")
        
        user.is_active = True
        await self.db.flush()
        
        logger.info("User activated", user_id=str(user_id))
        return True
