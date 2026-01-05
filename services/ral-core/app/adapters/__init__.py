"""
LLM Adapters Package

Provider-agnostic adapters for various LLM APIs.
Each adapter implements a common interface for context-aware completions.
"""

from app.adapters.base import (
    BaseLLMAdapter,
    Message,
    MessageRole,
    LLMConfig,
    LLMResponse,
    StreamChunk,
)
from app.adapters.openai_adapter import OpenAIAdapter
from app.adapters.anthropic_adapter import AnthropicAdapter
from app.adapters.google_adapter import GoogleAdapter
from app.adapters.factory import (
    AdapterFactory,
    LLMProvider,
    get_adapter,
    complete_with_context,
)

__all__ = [
    # Base
    "BaseLLMAdapter",
    "Message",
    "MessageRole",
    "LLMConfig",
    "LLMResponse",
    "StreamChunk",
    # Adapters
    "OpenAIAdapter",
    "AnthropicAdapter",
    "GoogleAdapter",
    # Factory
    "AdapterFactory",
    "LLMProvider",
    "get_adapter",
    "complete_with_context",
]
