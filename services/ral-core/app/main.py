"""
RAL Core - Main Application Entry Point

This module initializes the FastAPI application with all middleware,
routes, and lifecycle handlers.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api import router as api_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.database import init_db, close_db
from app.core.redis import init_redis, close_redis

# Initialize structured logging
setup_logging()
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan handler.
    
    Manages startup and shutdown events for database connections,
    Redis connections, and other resources.
    """
    # Startup
    logger.info("Starting RAL Core Service", version=app.version)
    
    await init_db()
    logger.info("Database connection established")
    
    await init_redis()
    logger.info("Redis connection established")
    
    yield
    
    # Shutdown
    logger.info("Shutting down RAL Core Service")
    
    await close_redis()
    logger.info("Redis connection closed")
    
    await close_db()
    logger.info("Database connection closed")


def create_application() -> FastAPI:
    """
    Application factory function.
    
    Creates and configures the FastAPI application with all
    necessary middleware, routes, and settings.
    """
    app = FastAPI(
        title="Reality Anchoring Layer",
        description=(
            "Cloud-native, multi-tenant, model-agnostic context intelligence platform "
            "that maintains, reasons about, and injects real-world context for AI systems."
        ),
        version="0.1.0",
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
        openapi_url="/openapi.json" if settings.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )
    
    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Compression
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    
    # Include API routes
    app.include_router(api_router, prefix="/v1")
    
    # Health check endpoint (no prefix)
    @app.get("/health", tags=["Health"])
    async def health_check():
        """
        Health check endpoint for load balancers and orchestrators.
        """
        return {
            "status": "healthy",
            "service": "ral-core",
            "version": app.version,
        }
    
    @app.get("/", tags=["Root"])
    async def root():
        """
        Root endpoint with service information.
        """
        return {
            "service": "Reality Anchoring Layer",
            "version": app.version,
            "docs": "/docs" if settings.ENVIRONMENT != "production" else None,
        }
    
    return app


# Create application instance
app = create_application()
