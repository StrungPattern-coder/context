"""
RAL API v0 - Public API Contract

This is the stable, documented public API for RAL v0.1.
All endpoints here are part of the public contract and should
not change without version bump.
"""

from fastapi import APIRouter

from app.api.v0.context import router as context_router
from app.api.v0.prompt import router as prompt_router
from app.api.v0.drift import router as drift_router
from app.api.v0.universal import router as universal_router

router = APIRouter()

# Mount v0 routes
router.include_router(context_router, prefix="/context", tags=["Context"])
router.include_router(prompt_router, prefix="/prompt", tags=["Prompt"])
router.include_router(drift_router, prefix="/drift", tags=["Drift"])
router.include_router(universal_router, prefix="/universal", tags=["Universal"])
