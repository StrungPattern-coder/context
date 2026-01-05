"""
API Router Package

Aggregates all API route modules and exposes a unified router.
"""

from fastapi import APIRouter

# v1 routes (internal, may change)
from app.api.v1.context import router as context_router
from app.api.v1.prompt import router as prompt_router
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.dashboard import router as dashboard_router

# v0 routes (public contract, stable)
from app.api.v0 import router as v0_router

# Main API router
router = APIRouter()

# Include v0 public API (stable contract)
router.include_router(v0_router, prefix="/api/v0", tags=["Public API v0"])

# Include all v1 sub-routers (internal)
router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
router.include_router(context_router, prefix="/context", tags=["Context"])
router.include_router(prompt_router, prefix="/prompt", tags=["Prompt Composition"])
router.include_router(users_router, prefix="/users", tags=["Users"])
router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
