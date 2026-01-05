"""
Context Memory Service

Persistent, versioned, decaying context storage with tiered memory.
This is the central memory system for RAL.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID, uuid4
import json

import structlog
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.context import (
    Context,
    ContextVersion,
    ContextSession,
    ContextType,
    MemoryTier,
    DriftStatus,
)
from app.core.redis import context_cache, session_cache
from app.core.config import settings

logger = structlog.get_logger()


class ContextMemoryService:
    """
    Context Memory Service
    
    Manages the three-tier memory system:
    - Long-term: Persistent user defaults (PostgreSQL)
    - Short-term: Active session context (PostgreSQL + Redis)
    - Ephemeral: Temporary assumptions (Redis only)
    
    Features:
    - Version history for all changes
    - Time-based decay
    - Confidence tracking
    - Rollback capability
    - User edit support
    """
    
    def __init__(self, db: AsyncSession):
        """
        Initialize the Context Memory Service.
        
        Args:
            db: Async database session
        """
        self.db = db
        logger.info("Context memory service initialized")
    
    # ==================== CORE CRUD OPERATIONS ====================
    
    async def store(
        self,
        user_id: UUID,
        context_type: ContextType,
        key: str,
        value: dict[str, Any],
        memory_tier: MemoryTier = MemoryTier.SHORT_TERM,
        confidence: float = 0.5,
        source: str = "system",
        source_details: Optional[dict] = None,
        interpretation: Optional[dict] = None,
        session_id: Optional[str] = None,
        ttl_seconds: Optional[int] = None,
    ) -> Context:
        """
        Store a context element.
        
        Args:
            user_id: Owner user ID
            context_type: Type of context
            key: Context key
            value: Context value
            memory_tier: Storage tier
            confidence: Initial confidence score
            source: Source of context (client, inferred, user)
            source_details: Additional source metadata
            interpretation: Semantic interpretation
            session_id: Session ID for short-term context
            ttl_seconds: Optional TTL override
            
        Returns:
            Created context object
        """
        # Check for existing context with same key
        existing = await self._get_by_key(user_id, context_type, key)
        
        if existing:
            # Update existing context
            return await self.update(
                context_id=existing.id,
                value=value,
                confidence=confidence,
                source=source,
                interpretation=interpretation,
            )
        
        # Calculate expiration
        expires_at = None
        if memory_tier == MemoryTier.EPHEMERAL:
            ttl = ttl_seconds or settings.EPHEMERAL_CONTEXT_TTL_SECONDS
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl)
        
        # Create new context
        context = Context(
            user_id=user_id,
            context_type=context_type,
            memory_tier=memory_tier,
            key=key,
            value=value,
            interpretation=interpretation,
            confidence=confidence,
            source=source,
            source_details=source_details,
            session_id=session_id,
            expires_at=expires_at,
        )
        
        self.db.add(context)
        await self.db.flush()
        
        # Create initial version
        await self._create_version(
            context_id=context.id,
            version=1,
            value=value,
            interpretation=interpretation,
            confidence=confidence,
            changed_by=source,
            change_reason="Initial creation",
        )
        
        # Cache in Redis for fast access
        await self._cache_context(context)
        
        logger.info(
            "Context stored",
            context_id=str(context.id),
            user_id=str(user_id),
            type=context_type.value,
            key=key,
            tier=memory_tier.value,
        )
        
        return context
    
    async def update(
        self,
        context_id: UUID,
        value: Optional[dict[str, Any]] = None,
        confidence: Optional[float] = None,
        source: str = "system",
        interpretation: Optional[dict] = None,
        change_reason: Optional[str] = None,
    ) -> Context:
        """
        Update an existing context element.
        
        Maintains version history for the change.
        
        Args:
            context_id: ID of context to update
            value: New value (if changing)
            confidence: New confidence (if changing)
            source: Source of update
            interpretation: New interpretation
            change_reason: Reason for change
            
        Returns:
            Updated context object
        """
        # Fetch existing context
        context = await self.get_by_id(context_id)
        if not context:
            raise ValueError(f"Context not found: {context_id}")
        
        # Store previous value for version history
        previous_value = context.value.copy()
        
        # Get current version number
        current_version = await self._get_latest_version_number(context_id)
        
        # Apply updates
        if value is not None:
            context.value = value
        if confidence is not None:
            context.confidence = confidence
        if interpretation is not None:
            context.interpretation = interpretation
        
        context.source = source
        context.updated_at = datetime.now(timezone.utc)
        
        await self.db.flush()
        
        # Create version record
        await self._create_version(
            context_id=context.id,
            version=current_version + 1,
            value=context.value,
            interpretation=context.interpretation,
            confidence=context.confidence,
            changed_by=source,
            change_reason=change_reason or "Updated",
            previous_value=previous_value,
        )
        
        # Update cache
        await self._cache_context(context)
        
        logger.info(
            "Context updated",
            context_id=str(context_id),
            version=current_version + 1,
            source=source,
        )
        
        return context
    
    async def get_by_id(self, context_id: UUID) -> Optional[Context]:
        """
        Get context by ID.
        
        Args:
            context_id: Context ID
            
        Returns:
            Context object or None
        """
        result = await self.db.execute(
            select(Context).where(Context.id == context_id)
        )
        return result.scalar_one_or_none()
    
    async def get_user_context(
        self,
        user_id: UUID,
        context_type: Optional[ContextType] = None,
        memory_tier: Optional[MemoryTier] = None,
        active_only: bool = True,
        include_expired: bool = False,
    ) -> list[Context]:
        """
        Get all context for a user.
        
        Args:
            user_id: User ID
            context_type: Filter by type
            memory_tier: Filter by tier
            active_only: Only return active contexts
            include_expired: Include expired contexts
            
        Returns:
            List of context objects
        """
        # Try cache first for hot path
        cache_key = f"user:{user_id}:all"
        cached = await context_cache.get(cache_key)
        if cached and not context_type and not memory_tier:
            return [self._dict_to_context(c) for c in cached]
        
        # Build query
        conditions = [Context.user_id == user_id]
        
        if context_type:
            conditions.append(Context.context_type == context_type)
        
        if memory_tier:
            conditions.append(Context.memory_tier == memory_tier)
        
        if active_only:
            conditions.append(Context.is_active == True)
        
        if not include_expired:
            conditions.append(
                or_(
                    Context.expires_at.is_(None),
                    Context.expires_at > datetime.now(timezone.utc)
                )
            )
        
        result = await self.db.execute(
            select(Context)
            .where(and_(*conditions))
            .order_by(Context.context_type, Context.key)
        )
        
        contexts = list(result.scalars().all())
        
        # Cache the full context list
        if not context_type and not memory_tier:
            await context_cache.set(
                cache_key,
                [self._context_to_dict(c) for c in contexts],
                ttl=60,  # 1 minute cache
            )
        
        return contexts
    
    async def delete(
        self,
        context_id: UUID,
        soft_delete: bool = True,
    ) -> bool:
        """
        Delete a context element.
        
        Args:
            context_id: Context to delete
            soft_delete: If True, mark as inactive; if False, hard delete
            
        Returns:
            True if deleted
        """
        if soft_delete:
            await self.db.execute(
                update(Context)
                .where(Context.id == context_id)
                .values(
                    is_active=False,
                    deleted_at=datetime.now(timezone.utc)
                )
            )
        else:
            await self.db.execute(
                delete(Context).where(Context.id == context_id)
            )
        
        # Invalidate cache
        context = await self.get_by_id(context_id)
        if context:
            await self._invalidate_cache(context.user_id)
        
        logger.info(
            "Context deleted",
            context_id=str(context_id),
            soft_delete=soft_delete,
        )
        
        return True
    
    # ==================== CONFIDENCE & DECAY ====================
    
    async def apply_decay(
        self,
        user_id: Optional[UUID] = None,
        decay_factor: float = 0.95,
        min_confidence: float = 0.1,
    ) -> int:
        """
        Apply confidence decay to contexts.
        
        Should be run periodically (e.g., hourly).
        
        Args:
            user_id: Limit to specific user (None for all)
            decay_factor: Multiplier for decay (0.95 = 5% reduction)
            min_confidence: Floor for confidence
            
        Returns:
            Number of contexts updated
        """
        now = datetime.now(timezone.utc)
        decay_threshold = now - timedelta(hours=settings.CONTEXT_DECAY_HOURS)
        
        # Build conditions
        conditions = [
            Context.is_active == True,
            Context.updated_at < decay_threshold,
            Context.confidence > min_confidence,
            Context.memory_tier != MemoryTier.LONG_TERM,  # Don't decay long-term
        ]
        
        if user_id:
            conditions.append(Context.user_id == user_id)
        
        # Apply decay
        result = await self.db.execute(
            update(Context)
            .where(and_(*conditions))
            .values(
                confidence=func.greatest(
                    Context.confidence * decay_factor,
                    min_confidence
                ),
                drift_status=DriftStatus.STALE,
            )
        )
        
        count: int = getattr(result, 'rowcount', 0) or 0
        
        if count > 0:
            logger.info(
                "Applied confidence decay",
                contexts_updated=count,
                decay_factor=decay_factor,
            )
        
        return count
    
    async def confirm(
        self,
        context_id: UUID,
        confirmed_by: str = "user",
    ) -> Context:
        """
        Mark context as confirmed (increases confidence).
        
        Args:
            context_id: Context to confirm
            confirmed_by: Who confirmed
            
        Returns:
            Updated context
        """
        context = await self.get_by_id(context_id)
        if not context:
            raise ValueError(f"Context not found: {context_id}")
        
        context.confirm()
        await self.db.flush()
        
        # Update cache
        await self._cache_context(context)
        
        logger.info(
            "Context confirmed",
            context_id=str(context_id),
            new_confidence=context.confidence,
        )
        
        return context
    
    async def record_correction(
        self,
        context_id: UUID,
        new_value: dict[str, Any],
        corrected_by: str = "user",
    ) -> Context:
        """
        Record that a context was corrected by the user.
        
        Reduces confidence and tracks correction count.
        
        Args:
            context_id: Context that was wrong
            new_value: Corrected value
            corrected_by: Source of correction
            
        Returns:
            Updated context
        """
        context = await self.get_by_id(context_id)
        if not context:
            raise ValueError(f"Context not found: {context_id}")
        
        # Store old value
        old_value = context.value.copy()
        
        # Update value and record correction
        context.value = new_value
        context.record_correction()
        
        await self.db.flush()
        
        # Create version
        current_version = await self._get_latest_version_number(context_id)
        await self._create_version(
            context_id=context.id,
            version=current_version + 1,
            value=new_value,
            interpretation=context.interpretation,
            confidence=context.confidence,
            changed_by=corrected_by,
            change_reason="User correction",
            previous_value=old_value,
        )
        
        # Update cache
        await self._cache_context(context)
        
        logger.info(
            "Context correction recorded",
            context_id=str(context_id),
            correction_count=context.correction_count,
            new_confidence=context.confidence,
        )
        
        return context
    
    # ==================== VERSION HISTORY ====================
    
    async def get_history(
        self,
        context_id: UUID,
        limit: int = 10,
    ) -> list[ContextVersion]:
        """
        Get version history for a context.
        
        Args:
            context_id: Context ID
            limit: Maximum versions to return
            
        Returns:
            List of versions (newest first)
        """
        result = await self.db.execute(
            select(ContextVersion)
            .where(ContextVersion.context_id == context_id)
            .order_by(ContextVersion.version.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def rollback(
        self,
        context_id: UUID,
        to_version: int,
        rollback_by: str = "user",
    ) -> Context:
        """
        Rollback context to a previous version.
        
        Args:
            context_id: Context to rollback
            to_version: Target version number
            rollback_by: Who initiated rollback
            
        Returns:
            Rolled back context
        """
        # Get target version
        result = await self.db.execute(
            select(ContextVersion)
            .where(
                and_(
                    ContextVersion.context_id == context_id,
                    ContextVersion.version == to_version
                )
            )
        )
        target_version = result.scalar_one_or_none()
        
        if not target_version:
            raise ValueError(f"Version {to_version} not found for context {context_id}")
        
        # Apply rollback
        return await self.update(
            context_id=context_id,
            value=target_version.value,
            confidence=target_version.confidence,
            interpretation=target_version.interpretation,
            source=rollback_by,
            change_reason=f"Rollback to version {to_version}",
        )
    
    # ==================== SESSION MANAGEMENT ====================
    
    async def create_session(
        self,
        user_id: UUID,
        client_info: Optional[dict] = None,
    ) -> ContextSession:
        """
        Create a new context session.
        
        Args:
            user_id: User ID
            client_info: Client metadata
            
        Returns:
            New session
        """
        session = ContextSession(
            user_id=user_id,
            session_id=str(uuid4()),
            client_info=client_info,
        )
        
        self.db.add(session)
        await self.db.flush()
        
        # Cache session
        await session_cache.set(
            f"session:{session.session_id}",
            {
                "user_id": str(user_id),
                "started_at": session.started_at.isoformat(),
            },
            ttl=86400,  # 24 hours
        )
        
        logger.info(
            "Session created",
            session_id=session.session_id,
            user_id=str(user_id),
        )
        
        return session
    
    async def get_session(self, session_id: str) -> Optional[ContextSession]:
        """Get session by ID."""
        result = await self.db.execute(
            select(ContextSession)
            .where(ContextSession.session_id == session_id)
        )
        return result.scalar_one_or_none()
    
    async def update_session_activity(self, session_id: str) -> None:
        """Update last activity timestamp for session."""
        await self.db.execute(
            update(ContextSession)
            .where(ContextSession.session_id == session_id)
            .values(last_activity_at=datetime.now(timezone.utc))
        )
    
    async def end_session(
        self,
        session_id: str,
        snapshot: Optional[dict] = None,
    ) -> None:
        """
        End a session.
        
        Args:
            session_id: Session to end
            snapshot: Final context snapshot
        """
        await self.db.execute(
            update(ContextSession)
            .where(ContextSession.session_id == session_id)
            .values(
                ended_at=datetime.now(timezone.utc),
                context_snapshot=snapshot,
            )
        )
        
        # Clear session cache
        await session_cache.delete(f"session:{session_id}")
        
        logger.info("Session ended", session_id=session_id)
    
    # ==================== CLEANUP ====================
    
    async def cleanup_expired(self) -> int:
        """
        Remove expired ephemeral contexts.
        
        Returns:
            Number of contexts removed
        """
        now = datetime.now(timezone.utc)
        
        result = await self.db.execute(
            delete(Context)
            .where(
                and_(
                    Context.memory_tier == MemoryTier.EPHEMERAL,
                    Context.expires_at.isnot(None),
                    Context.expires_at < now
                )
            )
        )
        
        count: int = getattr(result, 'rowcount', 0) or 0
        
        if count > 0:
            logger.info("Cleaned up expired contexts", count=count)
        
        return count
    
    # ==================== PRIVATE HELPERS ====================
    
    async def _get_by_key(
        self,
        user_id: UUID,
        context_type: ContextType,
        key: str,
    ) -> Optional[Context]:
        """Get context by user, type, and key."""
        result = await self.db.execute(
            select(Context)
            .where(
                and_(
                    Context.user_id == user_id,
                    Context.context_type == context_type,
                    Context.key == key,
                    Context.is_active == True
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def _create_version(
        self,
        context_id: UUID,
        version: int,
        value: dict,
        interpretation: Optional[dict],
        confidence: float,
        changed_by: str,
        change_reason: Optional[str],
        previous_value: Optional[dict] = None,
    ) -> ContextVersion:
        """Create a version record."""
        version_record = ContextVersion(
            context_id=context_id,
            version=version,
            value=value,
            interpretation=interpretation,
            confidence=confidence,
            changed_by=changed_by,
            change_reason=change_reason,
            previous_value=previous_value,
        )
        
        self.db.add(version_record)
        await self.db.flush()
        
        return version_record
    
    async def _get_latest_version_number(self, context_id: UUID) -> int:
        """Get the latest version number for a context."""
        result = await self.db.execute(
            select(func.max(ContextVersion.version))
            .where(ContextVersion.context_id == context_id)
        )
        return result.scalar() or 0
    
    async def _cache_context(self, context: Context) -> None:
        """Cache a context in Redis."""
        await context_cache.set(
            f"context:{context.id}",
            self._context_to_dict(context),
            ttl=300,  # 5 minutes
        )
        
        # Invalidate user's full context cache
        await self._invalidate_cache(context.user_id)
    
    async def _invalidate_cache(self, user_id: UUID) -> None:
        """Invalidate cached context for a user."""
        await context_cache.delete(f"user:{user_id}:all")
    
    def _context_to_dict(self, context: Context) -> dict:
        """Convert context to cacheable dict."""
        return {
            "id": str(context.id),
            "user_id": str(context.user_id),
            "context_type": context.context_type.value,
            "memory_tier": context.memory_tier.value,
            "key": context.key,
            "value": context.value,
            "interpretation": context.interpretation,
            "confidence": context.confidence,
            "source": context.source,
            "drift_status": context.drift_status.value,
            "is_active": context.is_active,
            "created_at": context.created_at.isoformat(),
            "updated_at": context.updated_at.isoformat(),
        }
    
    def _dict_to_context(self, data: dict) -> Context:
        """Convert cached dict back to context object."""
        # This is a simplified reconstruction for cache reads
        # Full ORM object would need db query
        context = Context.__new__(Context)
        context.id = UUID(data["id"])
        context.user_id = UUID(data["user_id"])
        context.context_type = ContextType(data["context_type"])
        context.memory_tier = MemoryTier(data["memory_tier"])
        context.key = data["key"]
        context.value = data["value"]
        context.interpretation = data["interpretation"]
        context.confidence = data["confidence"]
        context.source = data["source"]
        context.drift_status = DriftStatus(data["drift_status"])
        context.is_active = data["is_active"]
        return context
