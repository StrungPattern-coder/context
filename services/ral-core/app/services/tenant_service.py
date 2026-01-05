"""
Tenant Service

Business logic for multi-tenant operations.
"""

from typing import Optional, List
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.models.user import User

logger = structlog.get_logger()


class TenantService:
    """
    Service for tenant management operations.
    
    Handles tenant creation, configuration, and user management.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_id(self, tenant_id: UUID) -> Optional[Tenant]:
        """Get a tenant by their ID."""
        result = await self.db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_api_key(self, api_key: str) -> Optional[Tenant]:
        """Get a tenant by their API key."""
        result = await self.db.execute(
            select(Tenant).where(Tenant.api_key == api_key)
        )
        return result.scalar_one_or_none()
    
    async def get_by_name(self, name: str) -> Optional[Tenant]:
        """Get a tenant by their name."""
        result = await self.db.execute(
            select(Tenant).where(Tenant.name == name)
        )
        return result.scalar_one_or_none()
    
    async def list_all(self, include_inactive: bool = False) -> List[Tenant]:
        """Get all tenants."""
        query = select(Tenant)
        if not include_inactive:
            query = query.where(Tenant.is_active == True)
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def create(
        self,
        name: str,
        slug: str,
        description: Optional[str] = None,
        settings: Optional[dict] = None,
    ) -> Tenant:
        """
        Create a new tenant.
        
        Args:
            name: Tenant name
            slug: Unique URL-safe identifier
            description: Optional description
            settings: Optional tenant-specific settings
            
        Returns:
            Created tenant object
        """
        # Check if tenant already exists
        existing = await self.get_by_name(name)
        if existing:
            raise ValueError(f"Tenant with name {name} already exists")
        
        import secrets
        api_key = f"ral_{secrets.token_urlsafe(32)}"
        
        tenant = Tenant(
            name=name,
            slug=slug,
            description=description,
            api_key=api_key,
            settings=settings or {},
        )
        
        self.db.add(tenant)
        await self.db.flush()
        
        logger.info(
            "Tenant created",
            tenant_id=str(tenant.id),
            name=name,
        )
        
        return tenant
    
    async def update(
        self,
        tenant_id: UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        settings: Optional[dict] = None,
    ) -> Tenant:
        """
        Update a tenant.
        
        Args:
            tenant_id: Tenant to update
            name: New name
            description: New description
            settings: New settings (merged with existing)
            max_users: New max users limit
            max_requests_per_minute: New rate limit
            
        Returns:
            Updated tenant object
        """
        tenant = await self.get_by_id(tenant_id)
        if not tenant:
            raise ValueError(f"Tenant not found: {tenant_id}")
        
        if name is not None:
            # Check if new name is taken
            existing = await self.get_by_name(name)
            if existing and existing.id != tenant_id:
                raise ValueError(f"Tenant with name {name} already exists")
            tenant.name = name
        
        if description is not None:
            tenant.description = description
        
        if settings is not None:
            tenant.settings = {**tenant.settings, **settings}
        
        await self.db.flush()
        
        logger.info("Tenant updated", tenant_id=str(tenant_id))
        return tenant
    
    async def regenerate_api_key(self, tenant_id: UUID) -> str:
        """
        Regenerate a tenant's API key.
        
        Args:
            tenant_id: Tenant to update
            
        Returns:
            New API key
        """
        tenant = await self.get_by_id(tenant_id)
        if not tenant:
            raise ValueError(f"Tenant not found: {tenant_id}")
        
        import secrets
        tenant.api_key = f"ral_{secrets.token_urlsafe(32)}"
        await self.db.flush()
        
        logger.info("Tenant API key regenerated", tenant_id=str(tenant_id))
        return tenant.api_key
    
    async def deactivate(self, tenant_id: UUID) -> bool:
        """
        Deactivate a tenant.
        
        Args:
            tenant_id: Tenant to deactivate
            
        Returns:
            True if successful
        """
        tenant = await self.get_by_id(tenant_id)
        if not tenant:
            raise ValueError(f"Tenant not found: {tenant_id}")
        
        tenant.is_active = False
        await self.db.flush()
        
        logger.info("Tenant deactivated", tenant_id=str(tenant_id))
        return True
    
    async def get_users(self, tenant_id: UUID) -> List[User]:
        """
        Get all users for a tenant.
        
        Args:
            tenant_id: Tenant ID
            
        Returns:
            List of users
        """
        result = await self.db.execute(
            select(User).where(User.tenant_id == tenant_id)
        )
        return list(result.scalars().all())
    
    async def get_user_count(self, tenant_id: UUID) -> int:
        """
        Get user count for a tenant.
        
        Args:
            tenant_id: Tenant ID
            
        Returns:
            Number of users
        """
        from sqlalchemy import func
        result = await self.db.execute(
            select(func.count(User.id)).where(User.tenant_id == tenant_id)
        )
        return result.scalar() or 0
