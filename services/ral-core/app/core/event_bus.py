"""
Event Bus - Async Context Resolution

Provides dual-path (Fast/Slow) context resolution:
- Fast Path: Synchronous atomic context (<10ms)
- Slow Path: Async high-entropy context via Redis pub/sub

Implements timeout/fallback logic for UX responsiveness.
"""

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Optional
from uuid import UUID, uuid4

import structlog

from app.core.redis import get_redis, RedisCache

logger = structlog.get_logger()


class ContextPriority(str, Enum):
    """Priority levels for context resolution."""
    ATOMIC = "atomic"           # Fast path: timezone, timestamp, locale
    ENRICHED = "enriched"       # Slow path: vector memory, web search
    BACKGROUND = "background"   # Very slow: cross-session analysis


@dataclass
class AtomicContext:
    """
    Fast-path atomic context resolved synchronously in <10ms.
    
    This is foundational context that never requires external lookups.
    """
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    timestamp_iso: str = ""
    day_of_week: str = ""
    day_of_week_number: int = 0
    time_of_day: str = ""  # morning, afternoon, evening, night
    hour_24: int = 0
    minute: int = 0
    timezone: str = "UTC"
    timezone_offset: str = "+00:00"
    locale: str = "en-US"
    language: str = "en"
    currency: str = "USD"
    date_format: str = "MM/DD/YYYY"
    
    def __post_init__(self):
        """Compute derived fields from timestamp."""
        if not self.timestamp_iso:
            self.timestamp_iso = self.timestamp.isoformat()
        if not self.day_of_week:
            self.day_of_week = self.timestamp.strftime("%A")
            self.day_of_week_number = self.timestamp.weekday()
        if not self.time_of_day:
            hour = self.timestamp.hour
            self.hour_24 = hour
            self.minute = self.timestamp.minute
            if 5 <= hour < 12:
                self.time_of_day = "morning"
            elif 12 <= hour < 17:
                self.time_of_day = "afternoon"
            elif 17 <= hour < 21:
                self.time_of_day = "evening"
            else:
                self.time_of_day = "night"
    
    def to_dict(self) -> dict:
        """Convert to dictionary for prompt injection."""
        return {
            "timestamp": self.timestamp_iso,
            "day_of_week": self.day_of_week,
            "time_of_day": self.time_of_day,
            "hour": self.hour_24,
            "minute": self.minute,
            "timezone": self.timezone,
            "timezone_offset": self.timezone_offset,
            "locale": self.locale,
            "language": self.language,
            "currency": self.currency,
            "date_format": self.date_format,
        }


@dataclass
class HighEntropyContext:
    """
    Slow-path high-entropy context resolved asynchronously.
    
    Includes vector memory retrieval, web search, cross-session analysis.
    """
    request_id: str = ""
    vector_memories: list[dict] = field(default_factory=list)
    web_grounding: list[dict] = field(default_factory=list)
    cross_session_insights: list[dict] = field(default_factory=list)
    semantic_relations: list[dict] = field(default_factory=list)
    resolved_at: Optional[datetime] = None
    resolution_time_ms: float = 0.0
    
    def to_dict(self) -> dict:
        """Convert to dictionary for prompt injection."""
        return {
            "request_id": self.request_id,
            "vector_memories": self.vector_memories,
            "web_grounding": self.web_grounding,
            "cross_session_insights": self.cross_session_insights,
            "semantic_relations": self.semantic_relations,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "resolution_time_ms": self.resolution_time_ms,
        }


@dataclass
class ContextResolutionRequest:
    """Request for async context resolution."""
    request_id: str
    user_id: str
    query: str
    priority: ContextPriority
    timeout_ms: int = 150
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict = field(default_factory=dict)


@dataclass
class ContextResolutionResult:
    """Result of context resolution combining fast and slow paths."""
    request_id: str
    atomic_context: AtomicContext
    high_entropy_context: Optional[HighEntropyContext] = None
    fast_path_time_ms: float = 0.0
    slow_path_time_ms: Optional[float] = None
    slow_path_completed: bool = False
    slow_path_timeout: bool = False
    total_time_ms: float = 0.0


class EventBus:
    """
    Dual-path Event Bus for context resolution.
    
    Fast Path (Synchronous):
    - Resolves atomic context immediately
    - Target: <10ms
    - No external calls required
    
    Slow Path (Asynchronous):
    - Publishes to Redis for high-entropy context
    - Subscribes to response channel
    - 150ms timeout with graceful fallback
    """
    
    # Channel names
    CHANNEL_REQUEST = "ral:context:request"
    CHANNEL_RESPONSE = "ral:context:response"
    
    # Default timeouts
    DEFAULT_SLOW_PATH_TIMEOUT_MS = 150
    FAST_PATH_TARGET_MS = 10
    
    def __init__(self):
        """Initialize the event bus."""
        self._subscribers: dict[str, list[Callable]] = {}
        self._pending_requests: dict[str, asyncio.Event] = {}
        self._results: dict[str, HighEntropyContext] = {}
        self._cache = RedisCache(prefix="ral:event")
        
        logger.info("Event bus initialized")
    
    def resolve_atomic_context(
        self,
        user_timezone: str = "UTC",
        user_locale: str = "en-US",
        user_language: str = "en",
        user_currency: str = "USD",
    ) -> AtomicContext:
        """
        Fast path: Resolve atomic context synchronously.
        
        This MUST complete in <10ms as it's the foundation for
        prompt assembly to begin immediately.
        
        Args:
            user_timezone: User's timezone
            user_locale: User's locale
            user_language: User's language
            user_currency: User's currency
            
        Returns:
            Atomic context with all foundational data
        """
        import time
        start = time.perf_counter()
        
        # Get current time in user's timezone
        from zoneinfo import ZoneInfo
        try:
            tz = ZoneInfo(user_timezone)
            now = datetime.now(tz)
        except Exception:
            now = datetime.now(timezone.utc)
            user_timezone = "UTC"
        
        # Determine timezone offset
        offset = now.strftime("%z")
        offset_formatted = f"{offset[:3]}:{offset[3:]}" if len(offset) == 5 else "+00:00"
        
        # Determine date format based on locale
        date_format = "MM/DD/YYYY"  # US default
        if user_locale.startswith("en-GB") or user_locale.startswith("en-AU"):
            date_format = "DD/MM/YYYY"
        elif user_locale.startswith("zh") or user_locale.startswith("ja") or user_locale.startswith("ko"):
            date_format = "YYYY/MM/DD"
        
        context = AtomicContext(
            timestamp=now,
            timezone=user_timezone,
            timezone_offset=offset_formatted,
            locale=user_locale,
            language=user_language,
            currency=user_currency,
            date_format=date_format,
        )
        
        elapsed_ms = (time.perf_counter() - start) * 1000
        
        if elapsed_ms > self.FAST_PATH_TARGET_MS:
            logger.warning(
                "Fast path exceeded target time",
                elapsed_ms=elapsed_ms,
                target_ms=self.FAST_PATH_TARGET_MS,
            )
        
        return context
    
    async def resolve_with_timeout(
        self,
        user_id: str,
        query: str,
        user_timezone: str = "UTC",
        user_locale: str = "en-US",
        timeout_ms: int = DEFAULT_SLOW_PATH_TIMEOUT_MS,
        enable_slow_path: bool = True,
    ) -> ContextResolutionResult:
        """
        Resolve context with dual-path logic and timeout.
        
        1. Immediately resolve atomic context (fast path)
        2. If slow path enabled, request high-entropy context async
        3. Wait up to timeout_ms for slow path
        4. Return with whatever context is available
        
        Args:
            user_id: User ID for context
            query: User's query for relevance matching
            user_timezone: User's timezone
            user_locale: User's locale  
            timeout_ms: Timeout for slow path in milliseconds
            enable_slow_path: Whether to request high-entropy context
            
        Returns:
            Combined context resolution result
        """
        import time
        start = time.perf_counter()
        request_id = str(uuid4())
        
        # FAST PATH: Resolve atomic context immediately
        atomic_context = self.resolve_atomic_context(
            user_timezone=user_timezone,
            user_locale=user_locale,
        )
        fast_path_time = (time.perf_counter() - start) * 1000
        
        logger.debug(
            "Fast path completed",
            request_id=request_id,
            time_ms=fast_path_time,
        )
        
        # Build result with atomic context
        result = ContextResolutionResult(
            request_id=request_id,
            atomic_context=atomic_context,
            fast_path_time_ms=fast_path_time,
        )
        
        if not enable_slow_path:
            result.total_time_ms = fast_path_time
            return result
        
        # SLOW PATH: Request high-entropy context async
        slow_path_start = time.perf_counter()
        
        try:
            high_entropy = await asyncio.wait_for(
                self._request_high_entropy_context(request_id, user_id, query),
                timeout=timeout_ms / 1000.0,
            )
            
            result.high_entropy_context = high_entropy
            result.slow_path_completed = True
            result.slow_path_time_ms = (time.perf_counter() - slow_path_start) * 1000
            
            logger.debug(
                "Slow path completed",
                request_id=request_id,
                time_ms=result.slow_path_time_ms,
            )
            
        except asyncio.TimeoutError:
            result.slow_path_timeout = True
            result.slow_path_time_ms = timeout_ms
            
            logger.info(
                "Slow path timeout - proceeding with atomic context only",
                request_id=request_id,
                timeout_ms=timeout_ms,
            )
        
        result.total_time_ms = (time.perf_counter() - start) * 1000
        return result
    
    async def _request_high_entropy_context(
        self,
        request_id: str,
        user_id: str,
        query: str,
    ) -> HighEntropyContext:
        """
        Request high-entropy context via Redis pub/sub.
        
        Publishes request and awaits response on dedicated channel.
        """
        import time
        start = time.perf_counter()
        
        # Create request
        request = ContextResolutionRequest(
            request_id=request_id,
            user_id=user_id,
            query=query,
            priority=ContextPriority.ENRICHED,
        )
        
        # Store pending request
        event = asyncio.Event()
        self._pending_requests[request_id] = event
        
        try:
            # Publish request to Redis
            redis = get_redis()
            await redis.publish(
                self.CHANNEL_REQUEST,
                json.dumps({
                    "request_id": request.request_id,
                    "user_id": request.user_id,
                    "query": request.query,
                    "priority": request.priority.value,
                    "created_at": request.created_at.isoformat(),
                }),
            )
            
            # Wait for response
            await event.wait()
            
            # Get result
            result = self._results.pop(request_id, None)
            if result:
                result.resolution_time_ms = (time.perf_counter() - start) * 1000
                return result
            
            # Return empty if no result
            return HighEntropyContext(
                request_id=request_id,
                resolved_at=datetime.now(timezone.utc),
                resolution_time_ms=(time.perf_counter() - start) * 1000,
            )
            
        finally:
            # Cleanup
            self._pending_requests.pop(request_id, None)
    
    async def handle_response(self, response_data: dict) -> None:
        """
        Handle incoming high-entropy context response.
        
        Called by the response subscriber when context is resolved.
        """
        request_id = response_data.get("request_id")
        if not request_id:
            return
        
        # Build high-entropy context from response
        high_entropy = HighEntropyContext(
            request_id=request_id,
            vector_memories=response_data.get("vector_memories", []),
            web_grounding=response_data.get("web_grounding", []),
            cross_session_insights=response_data.get("cross_session_insights", []),
            semantic_relations=response_data.get("semantic_relations", []),
            resolved_at=datetime.now(timezone.utc),
        )
        
        # Store result and signal completion
        self._results[request_id] = high_entropy
        
        event = self._pending_requests.get(request_id)
        if event:
            event.set()
    
    async def start_response_listener(self) -> None:
        """
        Start listening for high-entropy context responses.
        
        Should be called during application startup.
        """
        redis = get_redis()
        pubsub = redis.pubsub()
        await pubsub.subscribe(self.CHANNEL_RESPONSE)
        
        logger.info("Event bus response listener started")
        
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    data = json.loads(message["data"])
                    await self.handle_response(data)
                except Exception as e:
                    logger.error("Error handling response", error=str(e))


# Global event bus instance
event_bus = EventBus()


def get_event_bus() -> EventBus:
    """Get the global event bus instance."""
    return event_bus
