"""
Anthropic Adapter

Adapter for Anthropic's Claude models (Claude 3, Claude 3.5, etc.)
"""

from collections.abc import AsyncGenerator
from typing import Any, Optional
import os

import structlog
from anthropic import AsyncAnthropic

from app.adapters.base import (
    BaseLLMAdapter,
    Message,
    MessageRole,
    LLMConfig,
    LLMResponse,
    StreamChunk,
)
from app.core.config import settings

logger = structlog.get_logger()


class AnthropicAdapter(BaseLLMAdapter):
    """
    Adapter for Anthropic's Claude API.
    
    Supports Claude 3 Opus, Sonnet, Haiku and other models.
    """
    
    provider_name = "anthropic"
    
    supported_models = [
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
        "claude-3-5-sonnet-20240620",
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-2.1",
        "claude-2.0",
    ]
    
    default_model = "claude-3-5-sonnet-20241022"
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Anthropic adapter.
        
        Args:
            api_key: Anthropic API key (uses ANTHROPIC_API_KEY env var if not provided)
        """
        self.api_key = api_key or settings.ANTHROPIC_API_KEY or os.getenv("ANTHROPIC_API_KEY")
        self._client: Optional[AsyncAnthropic] = None
        self._validate_configuration()
    
    def _validate_configuration(self) -> None:
        """Validate Anthropic configuration."""
        if not self.api_key:
            logger.warning("Anthropic API key not configured")
    
    @property
    def client(self) -> AsyncAnthropic:
        """Get or create async Anthropic client."""
        if self._client is None:
            if not self.api_key:
                raise ValueError("Anthropic API key required")
            self._client = AsyncAnthropic(api_key=self.api_key)
        return self._client
    
    async def complete(
        self,
        messages: list[Message],
        config: Optional[LLMConfig] = None,
        context: Optional[str] = None,
    ) -> LLMResponse:
        """
        Generate a message using Claude.
        
        Args:
            messages: Conversation messages
            config: LLM configuration
            context: RAL context to inject
            
        Returns:
            LLM response
        """
        config = config or LLMConfig(model=self.default_model)
        
        # Extract system message and inject context
        system_content = ""
        context_tokens = 0
        
        # Get existing system message
        non_system_messages = []
        for msg in messages:
            if msg.role == MessageRole.SYSTEM:
                system_content = msg.content
            else:
                non_system_messages.append(msg)
        
        # Inject RAL context into system
        if context and config.inject_context:
            if system_content:
                system_content = f"{context}\n\n{system_content}"
            else:
                system_content = context
            context_tokens = self.estimate_tokens(context)
        
        # Format messages for Anthropic (no system role in messages)
        formatted_messages = self.format_messages(non_system_messages)
        
        # Build request parameters
        params = self.get_provider_config(config)
        params["messages"] = formatted_messages
        
        if system_content:
            params["system"] = system_content
        
        logger.debug(
            "Making Anthropic completion request",
            model=config.model,
            message_count=len(non_system_messages),
            has_system=bool(system_content),
            context_injected=bool(context),
        )
        
        try:
            response = await self.client.messages.create(**params)
            
            # Extract response content
            content = ""
            for block in response.content:
                if hasattr(block, 'text'):
                    content += block.text
            
            return LLMResponse(
                content=content,
                model=response.model,
                usage={
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                    "total_tokens": response.usage.input_tokens + response.usage.output_tokens,
                },
                finish_reason=response.stop_reason,
                raw_response=response,
                context_injected=bool(context),
                context_tokens=context_tokens,
            )
            
        except Exception as e:
            logger.error("Anthropic completion failed", error=str(e))
            raise
    
    async def stream(
        self,
        messages: list[Message],
        config: Optional[LLMConfig] = None,
        context: Optional[str] = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        """
        Stream a message using Claude.
        
        Args:
            messages: Conversation messages
            config: LLM configuration
            context: RAL context to inject
            
        Yields:
            Stream chunks
        """
        config = config or LLMConfig(model=self.default_model, stream=True)
        
        # Extract system message and inject context
        system_content = ""
        
        non_system_messages = []
        for msg in messages:
            if msg.role == MessageRole.SYSTEM:
                system_content = msg.content
            else:
                non_system_messages.append(msg)
        
        if context and config.inject_context:
            if system_content:
                system_content = f"{context}\n\n{system_content}"
            else:
                system_content = context
        
        # Format messages
        formatted_messages = self.format_messages(non_system_messages)
        
        # Build request parameters
        params = self.get_provider_config(config)
        params["messages"] = formatted_messages
        
        if system_content:
            params["system"] = system_content
        
        logger.debug(
            "Making Anthropic streaming request",
            model=config.model,
            message_count=len(non_system_messages),
        )
        
        try:
            async with self.client.messages.stream(**params) as stream:
                async for text in stream.text_stream:
                    yield StreamChunk(
                        content=text,
                        is_final=False,
                    )
                
                # Final chunk
                yield StreamChunk(
                    content="",
                    is_final=True,
                    finish_reason="end_turn",
                )
                
        except Exception as e:
            logger.error("Anthropic streaming failed", error=str(e))
            raise
    
    def format_messages(self, messages: list[Message]) -> list[dict]:
        """
        Format messages for Anthropic API.
        
        Anthropic doesn't use system role in messages array.
        
        Args:
            messages: Standard messages (excluding system)
            
        Returns:
            Anthropic-formatted messages
        """
        formatted = []
        for msg in messages:
            # Map roles
            role = msg.role.value
            if role == "system":
                continue  # System handled separately
            
            formatted.append({
                "role": role,
                "content": msg.content,
            })
        return formatted
    
    def get_provider_config(self, config: LLMConfig) -> dict:
        """
        Convert standard config to Anthropic format.
        
        Args:
            config: Standard configuration
            
        Returns:
            Anthropic API parameters
        """
        params = {
            "model": config.model,
            "max_tokens": config.max_tokens,
            "temperature": config.temperature,
            "top_p": config.top_p,
        }
        
        if config.stop:
            params["stop_sequences"] = config.stop
        
        return params
    
    def estimate_tokens(self, text: str) -> int:
        """
        Estimate token count for Claude models.
        
        Args:
            text: Text to estimate
            
        Returns:
            Estimated token count
        """
        # Claude tokenizer is similar to GPT
        return len(text) // 3
