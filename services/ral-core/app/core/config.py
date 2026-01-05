"""
Application Configuration

Centralized configuration management using Pydantic Settings.
All configuration is loaded from environment variables with sensible defaults.
"""

from functools import lru_cache
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    
    All settings have sensible defaults for development but should
    be overridden in production through environment variables.
    """
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )
    
    # Application
    APP_NAME: str = "RAL Core"
    ENVIRONMENT: str = Field(default="development", description="Runtime environment")
    DEBUG: bool = Field(default=False, description="Enable debug mode")
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")
    
    # Security
    SECRET_KEY: str = Field(
        default="dev-secret-key-please-change-in-production",
        description="Secret key for JWT encoding"
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, description="JWT token expiry")
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, description="Refresh token expiry")
    ALGORITHM: str = Field(default="HS256", description="JWT algorithm")
    
    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://ral:ral_dev_password@localhost:5432/ral",
        description="PostgreSQL connection string"
    )
    DATABASE_POOL_SIZE: int = Field(default=5, description="Connection pool size")
    DATABASE_MAX_OVERFLOW: int = Field(default=10, description="Max pool overflow")
    
    # Redis
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection string"
    )
    REDIS_POOL_SIZE: int = Field(default=10, description="Redis connection pool size")
    
    # CORS - stored as comma-separated string, parsed to list
    CORS_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:8000",
        description="Allowed CORS origins (comma-separated)"
    )
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Get CORS origins as a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    # Context Engine Settings
    DEFAULT_CONFIDENCE_THRESHOLD: float = Field(
        default=0.5,
        description="Minimum confidence for silent assumption"
    )
    HIGH_CONFIDENCE_THRESHOLD: float = Field(
        default=0.8,
        description="Threshold for high confidence assumptions"
    )
    CONTEXT_DECAY_HOURS: int = Field(
        default=24,
        description="Hours after which context starts decaying"
    )
    EPHEMERAL_CONTEXT_TTL_SECONDS: int = Field(
        default=3600,
        description="TTL for ephemeral context in seconds"
    )
    
    # LLM Provider Settings
    OPENAI_API_KEY: Optional[str] = Field(default=None, description="OpenAI API key")
    ANTHROPIC_API_KEY: Optional[str] = Field(default=None, description="Anthropic API key")
    GOOGLE_API_KEY: Optional[str] = Field(default=None, description="Google AI API key")
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = Field(default=100, description="Requests per minute")
    RATE_LIMIT_WINDOW: int = Field(default=60, description="Rate limit window in seconds")
    
    # Prompt Composition
    MAX_CONTEXT_TOKENS: int = Field(
        default=500,
        description="Maximum tokens for context injection"
    )
    MIN_RELEVANCE_SCORE: float = Field(
        default=0.3,
        description="Minimum relevance score for context inclusion"
    )


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    
    Uses lru_cache to ensure settings are only loaded once.
    """
    return Settings()


# Global settings instance
settings = get_settings()
