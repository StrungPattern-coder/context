"""
Prompt Composition Schemas

Schemas for prompt composition and context injection.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


class LLMProvider(str, Enum):
    """Supported LLM providers."""
    
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    MISTRAL = "mistral"
    LLAMA = "llama"
    CUSTOM = "custom"


class InjectionStyle(str, Enum):
    """How context is injected into prompts."""
    
    SYSTEM_PREFIX = "system_prefix"    # Prepend to system message
    SYSTEM_SUFFIX = "system_suffix"    # Append to system message
    USER_PREFIX = "user_prefix"        # Prepend to user message
    STRUCTURED = "structured"          # Structured JSON block
    NATURAL = "natural"                # Natural language integration


class ContextRelevance(str, Enum):
    """Relevance classification for context elements."""
    
    CRITICAL = "critical"    # Must be included
    HIGH = "high"           # Should be included
    MEDIUM = "medium"       # Include if space permits
    LOW = "low"             # Omit unless specifically needed
    IRRELEVANT = "irrelevant"  # Do not include


class ContextInjection(BaseSchema):
    """
    A piece of context to be injected into a prompt.
    
    Represents a single context element with its injection metadata.
    """
    
    # Context identification
    context_type: str
    key: str
    
    # Content
    value: Any
    formatted_value: str = Field(
        description="Human-readable formatted value for injection"
    )
    
    # Injection metadata
    relevance: ContextRelevance
    relevance_score: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    
    # Token estimation
    estimated_tokens: int = Field(
        description="Estimated token count for this injection"
    )
    
    # Inclusion decision
    include: bool = Field(
        description="Whether to include in final prompt"
    )
    exclusion_reason: Optional[str] = None


class PromptComposeRequest(BaseSchema):
    """
    Request to compose a prompt with context injection.
    
    The primary interface for getting context-aware prompts.
    """
    
    # User identification
    user_id: str = Field(description="External user identifier")
    
    # Original prompt
    original_prompt: str = Field(
        description="The original user prompt/message"
    )
    system_prompt: Optional[str] = Field(
        default=None,
        description="Optional system prompt to augment"
    )
    
    # Target provider
    provider: LLMProvider = Field(
        default=LLMProvider.OPENAI,
        description="Target LLM provider"
    )
    model: Optional[str] = Field(
        default=None,
        description="Specific model identifier"
    )
    
    # Composition preferences
    injection_style: InjectionStyle = Field(
        default=InjectionStyle.SYSTEM_PREFIX,
        description="How to inject context"
    )
    max_context_tokens: Optional[int] = Field(
        default=None,
        description="Maximum tokens for context (overrides default)"
    )
    
    # Context selection
    include_temporal: bool = True
    include_spatial: bool = True
    include_situational: bool = True
    
    # Session
    session_id: Optional[str] = None


class PromptComposeResponse(BaseSchema):
    """
    Response containing the composed prompt.
    
    Includes the final prompt and injection audit.
    """
    
    # Identification
    composition_id: UUID
    user_id: str
    
    # Composed output
    composed_prompt: str = Field(
        description="The final composed user prompt"
    )
    composed_system_prompt: Optional[str] = Field(
        default=None,
        description="The final composed system prompt"
    )
    
    # For direct use with provider APIs
    messages: list[dict[str, str]] = Field(
        description="Ready-to-use messages array for LLM API"
    )
    
    # Injection audit
    injections: list[ContextInjection] = Field(
        description="All context injections considered"
    )
    included_injections: list[ContextInjection] = Field(
        description="Context injections that were included"
    )
    excluded_injections: list[ContextInjection] = Field(
        description="Context injections that were excluded"
    )
    
    # Token accounting
    original_tokens: int
    context_tokens: int
    total_tokens: int
    token_budget_remaining: int
    
    # Metadata
    provider: LLMProvider
    injection_style: InjectionStyle
    composed_at: datetime
    
    # Quality indicators
    overall_confidence: float = Field(
        ge=0.0, le=1.0,
        description="Overall confidence in context accuracy"
    )
    clarifications_suggested: list[str] = Field(
        default_factory=list,
        description="Suggested clarifications for low-confidence context"
    )


class PromptAuditRecord(BaseSchema):
    """
    Audit record for a prompt composition.
    
    Used for debugging and transparency.
    """
    
    composition_id: UUID
    user_id: str
    timestamp: datetime
    
    # Input
    original_prompt_preview: str = Field(
        description="First 200 chars of original prompt"
    )
    
    # Context considered
    context_elements_considered: int
    context_elements_included: int
    context_elements_excluded: int
    
    # Decisions
    decisions: list[dict[str, Any]] = Field(
        description="Log of inclusion/exclusion decisions"
    )
    
    # Performance
    composition_time_ms: float
    
    # Provider
    provider: LLMProvider
    model: Optional[str] = None
