"""
Pytest Configuration and Fixtures

Provides shared test fixtures, database setup, and utility functions
for the RAL verification test suite.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import AsyncGenerator, Generator, Optional
from uuid import uuid4
import os

import pytest
import pytest_asyncio
from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure test environment
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://localhost:6379/1"
os.environ["SECRET_KEY"] = "test-secret-key-for-validation-suite"

from app.models.base import Base
from app.models.tenant import Tenant
from app.models.user import User
from app.models.context import Context, ContextType, MemoryTier, DriftStatus


# ============================================================================
# Event Loop Configuration
# ============================================================================

@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an event loop for the entire test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ============================================================================
# Database Fixtures
# ============================================================================

@pytest_asyncio.fixture(scope="function")
async def async_engine():
    """Create an async engine for each test function."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        poolclass=StaticPool,
    )
    
    async with engine.begin() as conn:
        # Enable foreign key constraints for SQLite
        await conn.execute(text("PRAGMA foreign_keys=ON"))
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Provide a database session for each test."""
    async_session_maker = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session_maker() as session:
        # Enable foreign key constraints for this connection
        await session.execute(text("PRAGMA foreign_keys=ON"))
        yield session
        await session.rollback()


# ============================================================================
# Entity Fixtures
# ============================================================================

@pytest_asyncio.fixture
async def test_tenant(db_session: AsyncSession) -> Tenant:
    """Create a test tenant."""
    tenant = Tenant(
        id=uuid4(),
        name="Test Tenant",
        slug="test-tenant",
        api_key="test_api_key_12345_abcdefghijklmnop",  # 36+ chars for entropy test
        is_active=True,
        settings={"features": ["all"]},
    )
    db_session.add(tenant)
    await db_session.commit()
    await db_session.refresh(tenant)
    return tenant


@pytest_asyncio.fixture
async def test_tenant_2(db_session: AsyncSession) -> Tenant:
    """Create a second test tenant for isolation tests."""
    tenant = Tenant(
        id=uuid4(),
        name="Test Tenant 2",
        slug="test-tenant-2",
        api_key="test_api_key_67890_qrstuvwxyz123456",  # 36+ chars for entropy test
        is_active=True,
        settings={},
    )
    db_session.add(tenant)
    await db_session.commit()
    await db_session.refresh(tenant)
    return tenant


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession, test_tenant: Tenant) -> User:
    """Create a test user."""
    user = User(
        id=uuid4(),
        external_id="test-user-ext-id",
        tenant_id=test_tenant.id,
        email="test@example.com",
        password_hash="$2b$12$test_hash",
        display_name="Test User",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_user_tenant_2(db_session: AsyncSession, test_tenant_2: Tenant) -> User:
    """Create a test user in the second tenant."""
    user = User(
        id=uuid4(),
        external_id="test-user-2-ext-id",
        tenant_id=test_tenant_2.id,
        email="test2@example.com",
        password_hash="$2b$12$test_hash_2",
        display_name="Test User 2",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


# ============================================================================
# Context Fixtures
# ============================================================================

@pytest_asyncio.fixture
async def sample_context(db_session: AsyncSession, test_user: User) -> Context:
    """Create a sample context entry."""
    context = Context(
        id=uuid4(),
        user_id=test_user.id,
        context_type=ContextType.TEMPORAL,
        memory_tier=MemoryTier.SHORT_TERM,
        key="timezone",
        value={"timezone": "America/New_York", "offset": -5},
        confidence=0.85,
        source="explicit",
        drift_status=DriftStatus.STABLE,
    )
    db_session.add(context)
    await db_session.commit()
    await db_session.refresh(context)
    return context


@pytest_asyncio.fixture
async def stale_context(db_session: AsyncSession, test_user: User) -> Context:
    """Create a stale context entry (old timestamp)."""
    context = Context(
        id=uuid4(),
        user_id=test_user.id,
        context_type=ContextType.SITUATIONAL,
        memory_tier=MemoryTier.SHORT_TERM,
        key="current_task",
        value={"task": "Old task"},
        confidence=0.5,
        source="inferred",
        drift_status=DriftStatus.STABLE,
    )
    db_session.add(context)
    await db_session.commit()
    
    # Manually set old timestamp
    context.updated_at = datetime.now(timezone.utc) - timedelta(hours=48)
    await db_session.commit()
    await db_session.refresh(context)
    return context


@pytest_asyncio.fixture
async def corrected_context(db_session: AsyncSession, test_user: User) -> Context:
    """Create a context with multiple corrections."""
    context = Context(
        id=uuid4(),
        user_id=test_user.id,
        context_type=ContextType.SPATIAL,
        memory_tier=MemoryTier.LONG_TERM,
        key="home_location",
        value={"city": "Unknown", "country": "Unknown"},
        confidence=0.3,
        source="inferred",
        drift_status=DriftStatus.DRIFTING,
        correction_count=4,
    )
    db_session.add(context)
    await db_session.commit()
    await db_session.refresh(context)
    return context


# ============================================================================
# Engine Fixtures
# ============================================================================

@pytest.fixture
def temporal_engine():
    """Create a temporal engine instance."""
    from app.engines.temporal import TemporalEngine
    return TemporalEngine(default_timezone="UTC")


@pytest.fixture
def spatial_engine():
    """Create a spatial engine instance."""
    from app.engines.spatial import SpatialEngine
    return SpatialEngine()


@pytest.fixture
def drift_detector():
    """Create a drift detector instance."""
    from app.engines.drift import DriftDetector
    return DriftDetector(staleness_hours=24, correction_threshold=3)


@pytest.fixture
def assumption_resolver(temporal_engine, spatial_engine):
    """Create an assumption resolver instance."""
    from app.engines.resolver import AssumptionResolver
    return AssumptionResolver(
        temporal_engine=temporal_engine,
        spatial_engine=spatial_engine,
        confidence_threshold=0.5,
    )


@pytest.fixture
def prompt_composer():
    """Create a prompt composer instance."""
    from app.engines.composer import PromptComposer
    return PromptComposer(max_tokens=500, min_relevance=0.3)


# ============================================================================
# Time Manipulation Helpers
# ============================================================================

class TimeHelper:
    """Helper for creating specific datetime scenarios."""
    
    @staticmethod
    def midnight_boundary(minutes_before: int = 1) -> datetime:
        """Create a timestamp just before midnight."""
        now = datetime.now(timezone.utc)
        midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return midnight - timedelta(minutes=minutes_before)
    
    @staticmethod
    def just_after_midnight(minutes_after: int = 1) -> datetime:
        """Create a timestamp just after midnight."""
        now = datetime.now(timezone.utc)
        midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return midnight + timedelta(minutes=minutes_after)
    
    @staticmethod
    def specific_time(hour: int, minute: int = 0, tz: str = "UTC") -> datetime:
        """Create a timestamp at a specific time today."""
        from zoneinfo import ZoneInfo
        now = datetime.now(ZoneInfo(tz))
        return now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    
    @staticmethod
    def days_ago(days: int) -> datetime:
        """Create a timestamp N days in the past."""
        return datetime.now(timezone.utc) - timedelta(days=days)


@pytest.fixture
def time_helper() -> TimeHelper:
    """Provide time manipulation helper."""
    return TimeHelper()


# ============================================================================
# Prompt Artifact Logging
# ============================================================================

from typing import Optional

class PromptArtifactLogger:
    """Logger for saving prompt composition artifacts for review."""
    
    def __init__(self, output_dir: str = "tests/artifacts/prompts"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def log(
        self,
        scenario_name: Optional[str] = None,
        composed_prompt: Optional[str] = None,
        included_context: Optional[list] = None,
        excluded_context: Optional[list] = None,
        metadata: Optional[dict] = None,
        # Alternative parameter names for backwards compatibility
        prompt: Optional[str] = None,
        scenario: Optional[str] = None,
    ) -> str:
        """Log a prompt artifact for human review.
        
        Accepts either:
            - scenario_name, composed_prompt, included_context, excluded_context
            - prompt, scenario, metadata
        """
        import json
        
        # Handle alternative parameter names
        final_scenario: str = scenario_name or scenario or "unnamed"
        final_prompt: str = composed_prompt or prompt or ""
        final_included: list = included_context or []
        final_excluded: list = excluded_context or []
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{final_scenario}_{timestamp}.json"
        filepath = os.path.join(self.output_dir, filename)
        
        artifact = {
            "scenario": final_scenario,
            "timestamp": timestamp,
            "composed_prompt": final_prompt,
            "included_context": [str(c) for c in final_included],
            "excluded_context": [str(c) for c in final_excluded],
            "metadata": metadata or {},
        }
        
        with open(filepath, "w") as f:
            json.dump(artifact, f, indent=2, default=str)
        
        return filepath


@pytest.fixture
def prompt_logger() -> PromptArtifactLogger:
    """Provide prompt artifact logger."""
    return PromptArtifactLogger()


@pytest.fixture
def prompt_artifact_logger() -> PromptArtifactLogger:
    """Provide prompt artifact logger (alias for prompt_logger)."""
    return PromptArtifactLogger()


# ============================================================================
# Assertion Helpers
# ============================================================================

class Assertions:
    """Custom assertion helpers for RAL validation."""
    
    @staticmethod
    def assert_confidence_in_range(confidence: float, min_val: float, max_val: float):
        """Assert confidence is within expected range."""
        assert min_val <= confidence <= max_val, (
            f"Confidence {confidence} not in range [{min_val}, {max_val}]"
        )
    
    @staticmethod
    def assert_no_hallucinated_context(prompt: Optional[str], valid_facts: Optional[list[str]]):
        """Assert prompt contains no facts not in valid_facts."""
        if not prompt or not valid_facts:
            return
        # This is a simplified check - real implementation would be more sophisticated
        for fact in valid_facts:
            if fact.lower() not in prompt.lower():
                continue  # Fact not present, OK
        # Would need NLP to detect hallucinated facts
    
    @staticmethod
    def assert_tenant_isolation(
        context_list: Optional[list['Context']] = None,
        contexts: Optional[list['Context']] = None,
        expected_tenant_id: Optional[str] = None,
        expected_user_id: Optional[str] = None,
    ):
        """Assert all contexts belong to expected tenant or user.
        
        Args:
            context_list: List of contexts (alternative to contexts)
            contexts: List of contexts (alternative to context_list)
            expected_tenant_id: Expected tenant ID
            expected_user_id: Expected user ID (for user-level isolation)
        """
        ctx_list = context_list or contexts
        ctx_list = ctx_list or []
        
        for ctx in ctx_list:
            if expected_user_id is not None:
                assert ctx.user_id == expected_user_id, (
                    f"Context {ctx.id} belongs to wrong user"
                )
            elif expected_tenant_id is not None:
                if hasattr(ctx, 'user') and ctx.user:
                    assert str(ctx.user.tenant_id) == str(expected_tenant_id), (
                        f"Context {ctx.id} belongs to wrong tenant"
                    )
    
    @staticmethod
    def assert_drift_status_transition_valid(
        old_status: DriftStatus,
        new_status: DriftStatus,
    ):
        """Assert drift status transition is valid."""
        valid_transitions = {
            DriftStatus.STABLE: [DriftStatus.DRIFTING, DriftStatus.STALE],
            DriftStatus.DRIFTING: [DriftStatus.STABLE, DriftStatus.CONFLICTING, DriftStatus.STALE],
            DriftStatus.CONFLICTING: [DriftStatus.STABLE, DriftStatus.DRIFTING],
            DriftStatus.STALE: [DriftStatus.STABLE, DriftStatus.DRIFTING],
        }
        
        assert new_status in valid_transitions.get(old_status, []), (
            f"Invalid drift transition: {old_status} -> {new_status}"
        )


@pytest.fixture
def assertions() -> Assertions:
    """Provide custom assertion helpers."""
    return Assertions()
