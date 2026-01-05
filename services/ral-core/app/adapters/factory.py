"""
LLM Adapter Factory

Provider-agnostic factory for creating LLM adapters.
"""

from typing import Optional, Type
from enum import Enum

import structlog

from app.adapters.base import BaseLLMAdapter
from app.adapters.openai_adapter import OpenAIAdapter
from app.adapters.anthropic_adapter import AnthropicAdapter
from app.adapters.google_adapter import GoogleAdapter

logger = structlog.get_logger()


class LLMProvider(str, Enum):
    """Supported LLM providers."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"


# Provider to adapter mapping
ADAPTER_REGISTRY: dict[LLMProvider, Type[BaseLLMAdapter]] = {
    LLMProvider.OPENAI: OpenAIAdapter,
    LLMProvider.ANTHROPIC: AnthropicAdapter,
    LLMProvider.GOOGLE: GoogleAdapter,
}


# Model to provider mapping for auto-detection
MODEL_PROVIDER_MAP: dict[str, LLMProvider] = {
    # OpenAI models
    "gpt-4o": LLMProvider.OPENAI,
    "gpt-4o-mini": LLMProvider.OPENAI,
    "gpt-4-turbo": LLMProvider.OPENAI,
    "gpt-4-turbo-preview": LLMProvider.OPENAI,
    "gpt-4": LLMProvider.OPENAI,
    "gpt-4-0613": LLMProvider.OPENAI,
    "gpt-3.5-turbo": LLMProvider.OPENAI,
    "gpt-3.5-turbo-0125": LLMProvider.OPENAI,
    "gpt-3.5-turbo-16k": LLMProvider.OPENAI,
    "o1-preview": LLMProvider.OPENAI,
    "o1-mini": LLMProvider.OPENAI,
    
    # Anthropic models
    "claude-3-5-sonnet-20241022": LLMProvider.ANTHROPIC,
    "claude-3-5-sonnet": LLMProvider.ANTHROPIC,
    "claude-3-5-haiku": LLMProvider.ANTHROPIC,
    "claude-3-opus-20240229": LLMProvider.ANTHROPIC,
    "claude-3-opus": LLMProvider.ANTHROPIC,
    "claude-3-sonnet-20240229": LLMProvider.ANTHROPIC,
    "claude-3-sonnet": LLMProvider.ANTHROPIC,
    "claude-3-haiku-20240307": LLMProvider.ANTHROPIC,
    "claude-3-haiku": LLMProvider.ANTHROPIC,
    "claude-2.1": LLMProvider.ANTHROPIC,
    "claude-2.0": LLMProvider.ANTHROPIC,
    
    # Google models
    "gemini-1.5-pro": LLMProvider.GOOGLE,
    "gemini-1.5-flash": LLMProvider.GOOGLE,
    "gemini-1.5-flash-8b": LLMProvider.GOOGLE,
    "gemini-1.0-pro": LLMProvider.GOOGLE,
    "gemini-pro": LLMProvider.GOOGLE,
    "gemini-pro-vision": LLMProvider.GOOGLE,
}


class AdapterFactory:
    """
    Factory for creating LLM adapters.
    
    Supports explicit provider selection or auto-detection from model name.
    """
    
    _instances: dict[LLMProvider, BaseLLMAdapter] = {}
    
    @classmethod
    def get_adapter(
        cls,
        provider: Optional[LLMProvider | str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> BaseLLMAdapter:
        """
        Get an LLM adapter instance.
        
        Args:
            provider: Explicit provider selection (optional if model specified)
            model: Model name for auto-detection (optional if provider specified)
            api_key: Custom API key (uses env vars if not provided)
            
        Returns:
            Configured adapter instance
            
        Raises:
            ValueError: If provider cannot be determined
        """
        # Convert string to enum
        if isinstance(provider, str):
            provider = LLMProvider(provider.lower())
        
        # Auto-detect provider from model if not specified
        if provider is None:
            if model is None:
                raise ValueError("Either provider or model must be specified")
            
            provider = cls.detect_provider(model)
            if provider is None:
                raise ValueError(f"Cannot determine provider for model: {model}")
        
        logger.debug(
            "Getting LLM adapter",
            provider=provider.value,
            model=model,
        )
        
        # Get adapter class
        adapter_class = ADAPTER_REGISTRY.get(provider)
        if adapter_class is None:
            raise ValueError(f"Unsupported provider: {provider}")
        
        # Create new instance if custom API key provided
        if api_key:
            return adapter_class(api_key=api_key)
        
        # Return cached instance for default API keys
        if provider not in cls._instances:
            cls._instances[provider] = adapter_class()
        
        return cls._instances[provider]
    
    @classmethod
    def detect_provider(cls, model: str) -> Optional[LLMProvider]:
        """
        Auto-detect provider from model name.
        
        Args:
            model: Model name
            
        Returns:
            Detected provider or None
        """
        # Exact match first
        if model in MODEL_PROVIDER_MAP:
            return MODEL_PROVIDER_MAP[model]
        
        # Prefix matching for flexibility
        model_lower = model.lower()
        
        if model_lower.startswith("gpt-") or model_lower.startswith("o1"):
            return LLMProvider.OPENAI
        
        if model_lower.startswith("claude"):
            return LLMProvider.ANTHROPIC
        
        if model_lower.startswith("gemini"):
            return LLMProvider.GOOGLE
        
        return None
    
    @classmethod
    def list_providers(cls) -> list[str]:
        """Get list of supported provider names."""
        return [p.value for p in LLMProvider]
    
    @classmethod
    def list_models(cls, provider: Optional[LLMProvider | str] = None) -> list[str]:
        """
        Get list of supported models.
        
        Args:
            provider: Filter by provider (optional)
            
        Returns:
            List of model names
        """
        if provider:
            if isinstance(provider, str):
                provider = LLMProvider(provider.lower())
            return [m for m, p in MODEL_PROVIDER_MAP.items() if p == provider]
        
        return list(MODEL_PROVIDER_MAP.keys())
    
    @classmethod
    def is_model_supported(cls, model: str) -> bool:
        """Check if a model is supported."""
        return cls.detect_provider(model) is not None
    
    @classmethod
    def clear_cache(cls) -> None:
        """Clear adapter instance cache."""
        cls._instances.clear()


# Convenience function
def get_adapter(
    provider: Optional[LLMProvider | str] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
) -> BaseLLMAdapter:
    """
    Get an LLM adapter instance.
    
    Convenience wrapper around AdapterFactory.get_adapter().
    
    Args:
        provider: Explicit provider selection
        model: Model name for auto-detection
        api_key: Custom API key
        
    Returns:
        Configured adapter instance
    """
    return AdapterFactory.get_adapter(provider=provider, model=model, api_key=api_key)


def complete_with_context(
    messages: list,
    model: str,
    context: Optional[str] = None,
    **kwargs,
):
    """
    Complete messages with RAL context injection.
    
    Convenience function for one-shot completions.
    
    Args:
        messages: Conversation messages
        model: Model to use
        context: RAL context to inject
        **kwargs: Additional configuration
        
    Returns:
        LLM response
    """
    from app.adapters.base import Message, MessageRole, LLMConfig
    
    adapter = get_adapter(model=model)
    
    # Convert dict messages to Message objects
    formatted_messages = []
    for msg in messages:
        if isinstance(msg, Message):
            formatted_messages.append(msg)
        elif isinstance(msg, dict):
            formatted_messages.append(Message(
                role=MessageRole(msg["role"]),
                content=msg["content"],
            ))
    
    # Build config
    config = LLMConfig(model=model, **kwargs)
    
    # This is sync wrapper - in production use async
    import asyncio
    return asyncio.run(adapter.complete(formatted_messages, config, context))
