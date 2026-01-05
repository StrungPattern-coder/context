"""
Base LLM Adapter

Abstract base class defining the interface all LLM adapters must implement.
Provides common functionality for context injection and response handling.
"""

from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional, AsyncIterator
from enum import Enum


class MessageRole(str, Enum):
    """Standard message roles."""
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


@dataclass
class Message:
    """
    A message in a conversation.
    
    Attributes:
        role: Message role (system, user, assistant)
        content: Message content
        name: Optional name for the message author
        metadata: Additional metadata
    """
    role: MessageRole
    content: str
    name: Optional[str] = None
    metadata: Optional[dict] = None
    
    def to_dict(self) -> dict:
        result = {
            "role": self.role.value,
            "content": self.content,
        }
        if self.name:
            result["name"] = self.name
        return result


@dataclass
class LLMConfig:
    """
    Configuration for LLM requests.
    
    Attributes:
        model: Model identifier
        temperature: Sampling temperature
        max_tokens: Maximum tokens to generate
        top_p: Nucleus sampling parameter
        stop: Stop sequences
        stream: Whether to stream response
    """
    model: str = "gpt-4"
    temperature: float = 0.7
    max_tokens: int = 2048
    top_p: float = 1.0
    stop: Optional[list[str]] = None
    stream: bool = False
    presence_penalty: float = 0.0
    frequency_penalty: float = 0.0
    
    # RAL-specific config
    inject_context: bool = True
    context_position: str = "system"  # "system", "first_user", "metadata"
    
    def to_dict(self) -> dict:
        return {
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "top_p": self.top_p,
            "stop": self.stop,
            "stream": self.stream,
            "presence_penalty": self.presence_penalty,
            "frequency_penalty": self.frequency_penalty,
        }


@dataclass
class LLMResponse:
    """
    Standardized response from LLM.
    
    Attributes:
        content: Generated text content
        model: Model used
        usage: Token usage statistics
        finish_reason: Why generation stopped
        raw_response: Original provider response
    """
    content: str
    model: str
    usage: dict = field(default_factory=dict)
    finish_reason: Optional[str] = None
    raw_response: Optional[Any] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    # RAL metadata
    context_injected: bool = False
    context_tokens: int = 0
    
    def to_dict(self) -> dict:
        return {
            "content": self.content,
            "model": self.model,
            "usage": self.usage,
            "finish_reason": self.finish_reason,
            "created_at": self.created_at.isoformat(),
            "context_injected": self.context_injected,
            "context_tokens": self.context_tokens,
        }


@dataclass
class StreamChunk:
    """
    A chunk of streaming response.
    
    Attributes:
        content: Chunk content
        is_final: Whether this is the final chunk
        finish_reason: Reason for stopping (if final)
    """
    content: str
    is_final: bool = False
    finish_reason: Optional[str] = None


class BaseLLMAdapter(ABC):
    """
    Abstract base class for LLM adapters.
    
    All provider-specific adapters must implement this interface.
    Provides common functionality for context injection and
    message formatting.
    """
    
    # Provider identifier
    provider_name: str = "base"
    
    # Supported models
    supported_models: list[str] = []
    
    # Default model
    default_model: str = ""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize adapter with API key.
        
        Args:
            api_key: Provider API key (uses env var if not provided)
        """
        self.api_key = api_key
        self._validate_configuration()
    
    def _validate_configuration(self) -> None:
        """Validate adapter configuration."""
        pass
    
    @abstractmethod
    async def complete(
        self,
        messages: list[Message],
        config: Optional[LLMConfig] = None,
        context: Optional[str] = None,
    ) -> LLMResponse:
        """
        Generate a completion.
        
        Args:
            messages: Conversation messages
            config: LLM configuration
            context: RAL context to inject
            
        Returns:
            LLM response
        """
        pass
    
    @abstractmethod
    def stream(
        self,
        messages: list[Message],
        config: Optional[LLMConfig] = None,
        context: Optional[str] = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        """
        Stream a completion.
        
        Args:
            messages: Conversation messages
            config: LLM configuration
            context: RAL context to inject
            
        Yields:
            Stream chunks
        """
        ...
    
    def inject_context(
        self,
        messages: list[Message],
        context: str,
        position: str = "system",
    ) -> list[Message]:
        """
        Inject RAL context into messages.
        
        Args:
            messages: Original messages
            context: Context to inject
            position: Where to inject ("system", "first_user", "prepend")
            
        Returns:
            Messages with context injected
        """
        if not context:
            return messages
        
        injected = list(messages)
        
        if position == "system":
            # Prepend to existing system message or create new one
            system_idx = None
            for i, msg in enumerate(injected):
                if msg.role == MessageRole.SYSTEM:
                    system_idx = i
                    break
            
            if system_idx is not None:
                # Prepend to existing system message
                original = injected[system_idx].content
                injected[system_idx] = Message(
                    role=MessageRole.SYSTEM,
                    content=f"{context}\n\n{original}",
                    metadata={"context_injected": True},
                )
            else:
                # Create new system message at beginning
                injected.insert(0, Message(
                    role=MessageRole.SYSTEM,
                    content=context,
                    metadata={"context_injected": True},
                ))
        
        elif position == "first_user":
            # Prepend to first user message
            for i, msg in enumerate(injected):
                if msg.role == MessageRole.USER:
                    original = injected[i].content
                    injected[i] = Message(
                        role=MessageRole.USER,
                        content=f"[Context: {context}]\n\n{original}",
                        metadata={"context_injected": True},
                    )
                    break
        
        elif position == "prepend":
            # Add as first message
            injected.insert(0, Message(
                role=MessageRole.SYSTEM,
                content=context,
                metadata={"context_injected": True},
            ))
        
        return injected
    
    def format_messages(self, messages: list[Message]) -> list[dict]:
        """
        Format messages for provider API.
        
        Override in subclasses for provider-specific formatting.
        
        Args:
            messages: Standard messages
            
        Returns:
            Provider-formatted messages
        """
        return [msg.to_dict() for msg in messages]
    
    def estimate_tokens(self, text: str) -> int:
        """
        Estimate token count for text.
        
        Simple estimation - override for provider-specific counting.
        
        Args:
            text: Text to estimate
            
        Returns:
            Estimated token count
        """
        # Rough estimate: ~4 characters per token
        return len(text) // 4
    
    def validate_model(self, model: str) -> bool:
        """
        Check if model is supported.
        
        Args:
            model: Model identifier
            
        Returns:
            True if supported
        """
        if not self.supported_models:
            return True
        return model in self.supported_models
    
    @abstractmethod
    def get_provider_config(self, config: LLMConfig) -> dict:
        """
        Convert standard config to provider-specific format.
        
        Args:
            config: Standard configuration
            
        Returns:
            Provider-specific config dict
        """
        pass
