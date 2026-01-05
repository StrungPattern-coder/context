"""
Redis Connection and Cache Management

Provides async Redis client configuration and utilities for caching,
session storage, and ephemeral context management.
"""

from typing import Any, Optional
import json

import redis.asyncio as redis
from redis.asyncio import ConnectionPool, Redis

from app.core.config import settings

# Global Redis client
_redis_client: Optional[Redis] = None
_connection_pool: Optional[ConnectionPool] = None


async def init_redis() -> None:
    """
    Initialize Redis connection pool.
    
    Called during application startup to establish Redis connection.
    """
    global _redis_client, _connection_pool
    
    _connection_pool = ConnectionPool.from_url(
        settings.REDIS_URL,
        max_connections=settings.REDIS_POOL_SIZE,
        decode_responses=True,
    )
    _redis_client = Redis(connection_pool=_connection_pool)
    
    # Verify connection - ping() is awaitable in redis.asyncio
    pong = await _redis_client.ping()  # type: ignore[misc]
    if not pong:
        raise ConnectionError("Redis connection failed")


async def close_redis() -> None:
    """
    Close Redis connections.
    
    Called during application shutdown to clean up resources.
    """
    global _redis_client, _connection_pool
    
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
    
    if _connection_pool:
        await _connection_pool.disconnect()
        _connection_pool = None


def get_redis() -> Redis:
    """
    Get Redis client instance.
    
    Returns:
        Configured Redis client
        
    Raises:
        RuntimeError: If Redis is not initialized
    """
    if _redis_client is None:
        raise RuntimeError("Redis client not initialized. Call init_redis() first.")
    return _redis_client


class RedisCache:
    """
    High-level Redis cache interface.
    
    Provides convenient methods for common caching operations
    with JSON serialization and TTL support.
    """
    
    def __init__(self, prefix: str = "ral"):
        """
        Initialize cache with key prefix.
        
        Args:
            prefix: Prefix for all cache keys (namespace isolation)
        """
        self.prefix = prefix
    
    def _key(self, key: str) -> str:
        """Generate prefixed cache key."""
        return f"{self.prefix}:{key}"
    
    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found
        """
        client = get_redis()
        value = await client.get(self._key(key))
        if value:
            return json.loads(value)
        return None
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
    ) -> None:
        """
        Set value in cache.
        
        Args:
            key: Cache key
            value: Value to cache (must be JSON serializable)
            ttl: Time-to-live in seconds (None for no expiry)
        """
        client = get_redis()
        serialized = json.dumps(value, default=str)
        if ttl:
            await client.setex(self._key(key), ttl, serialized)
        else:
            await client.set(self._key(key), serialized)
    
    async def delete(self, key: str) -> bool:
        """
        Delete value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            True if key existed and was deleted
        """
        client = get_redis()
        result = await client.delete(self._key(key))
        return result > 0
    
    async def exists(self, key: str) -> bool:
        """
        Check if key exists in cache.
        
        Args:
            key: Cache key
            
        Returns:
            True if key exists
        """
        client = get_redis()
        return await client.exists(self._key(key)) > 0
    
    async def increment(self, key: str, amount: int = 1) -> int:
        """
        Increment counter in cache.
        
        Args:
            key: Cache key
            amount: Amount to increment by
            
        Returns:
            New counter value
        """
        client = get_redis()
        return await client.incrby(self._key(key), amount)
    
    async def expire(self, key: str, ttl: int) -> bool:
        """
        Set TTL on existing key.
        
        Args:
            key: Cache key
            ttl: Time-to-live in seconds
            
        Returns:
            True if key exists and TTL was set
        """
        client = get_redis()
        return await client.expire(self._key(key), ttl)
    
    async def ttl(self, key: str) -> int:
        """
        Get remaining TTL for key.
        
        Args:
            key: Cache key
            
        Returns:
            TTL in seconds, -1 if no TTL, -2 if key doesn't exist
        """
        client = get_redis()
        return await client.ttl(self._key(key))


# Pre-configured cache instances
context_cache = RedisCache(prefix="ral:context")
session_cache = RedisCache(prefix="ral:session")
rate_limit_cache = RedisCache(prefix="ral:ratelimit")
