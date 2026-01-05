"""
Database Configuration and Session Management

Provides async SQLAlchemy engine, session factory, and dependency injection
for database access throughout the application.
"""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# Build engine kwargs based on database type
# SQLite doesn't support pool_size/max_overflow
_engine_kwargs: dict = {
    "echo": settings.DEBUG,
    "future": True,
}

if "sqlite" not in settings.DATABASE_URL:
    # PostgreSQL-specific pool settings
    _engine_kwargs["pool_size"] = settings.DATABASE_POOL_SIZE
    _engine_kwargs["max_overflow"] = settings.DATABASE_MAX_OVERFLOW

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    **_engine_kwargs,
)

# Session factory
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy models.
    
    Provides common functionality and configuration for all database models.
    """
    pass


async def init_db() -> None:
    """
    Initialize database connection and create tables.
    
    Called during application startup to ensure database is ready.
    """
    async with engine.begin() as conn:
        # Import models to register them with Base.metadata
        from app.models import context, user, tenant  # noqa: F401
        
        # Create tables (in development only - use Alembic in production)
        if settings.ENVIRONMENT == "development":
            await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """
    Close database connections.
    
    Called during application shutdown to clean up resources.
    """
    await engine.dispose()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency injection for database sessions.
    
    Yields an async session and ensures proper cleanup after use.
    
    Usage:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
