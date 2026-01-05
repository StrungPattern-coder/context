"""
Pydantic Schemas Package

Contains all request/response schemas for the API layer.
"""

from app.schemas.base import (
    BaseSchema,
    PaginationParams,
    PaginatedResponse,
)
from app.schemas.context import (
    ContextCreate,
    ContextUpdate,
    ContextResponse,
    ContextSignals,
    AnchorRequest,
    AnchorResponse,
    ContextInterpretation,
)
from app.schemas.temporal import (
    TemporalContext,
    TemporalInterpretation,
    TimeReference,
    ResolvedTimeReference,
)
from app.schemas.spatial import (
    SpatialContext,
    SpatialInterpretation,
    LocationReference,
)
from app.schemas.prompt import (
    PromptComposeRequest,
    PromptComposeResponse,
    ContextInjection,
)
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
)
from app.schemas.auth import (
    TokenResponse,
    LoginRequest,
)

__all__ = [
    # Base
    "BaseSchema",
    "PaginationParams",
    "PaginatedResponse",
    # Context
    "ContextCreate",
    "ContextUpdate",
    "ContextResponse",
    "ContextSignals",
    "AnchorRequest",
    "AnchorResponse",
    "ContextInterpretation",
    # Temporal
    "TemporalContext",
    "TemporalInterpretation",
    "TimeReference",
    "ResolvedTimeReference",
    # Spatial
    "SpatialContext",
    "SpatialInterpretation",
    "LocationReference",
    # Prompt
    "PromptComposeRequest",
    "PromptComposeResponse",
    "ContextInjection",
    # User
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    # Auth
    "TokenResponse",
    "LoginRequest",
]
