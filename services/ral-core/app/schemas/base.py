"""
Base Schemas

Common schema patterns and utilities used across all schemas.
"""

from datetime import datetime
from typing import Any, Generic, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BaseSchema(BaseModel):
    """
    Base schema with common configuration.
    
    All schemas should inherit from this class.
    """
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class TimestampSchema(BaseSchema):
    """Schema with timestamp fields."""
    
    created_at: datetime
    updated_at: datetime


class PaginationParams(BaseSchema):
    """Pagination parameters for list endpoints."""
    
    page: int = Field(default=1, ge=1, description="Page number")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page")
    
    @property
    def offset(self) -> int:
        """Calculate offset for database query."""
        return (self.page - 1) * self.page_size


T = TypeVar("T")


class PaginatedResponse(BaseSchema, Generic[T]):
    """Generic paginated response wrapper."""
    
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int
    
    @classmethod
    def create(
        cls,
        items: list[T],
        total: int,
        page: int,
        page_size: int,
    ) -> "PaginatedResponse[T]":
        """Create paginated response with calculated total pages."""
        total_pages = (total + page_size - 1) // page_size
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )


class ErrorResponse(BaseSchema):
    """Standard error response schema."""
    
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SuccessResponse(BaseSchema):
    """Standard success response schema."""
    
    success: bool = True
    message: Optional[str] = None
    data: Optional[dict[str, Any]] = None


class HealthResponse(BaseSchema):
    """Health check response schema."""
    
    status: str = "healthy"
    service: str
    version: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
