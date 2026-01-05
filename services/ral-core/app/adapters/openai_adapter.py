"""
OpenAI Adapter

Adapter for OpenAI's GPT models (GPT-4, GPT-4o, GPT-3.5-turbo, etc.)
"""

from collections.abc import AsyncGenerator
from typing import Any, Optional
import os

import structlog
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletion, ChatCompletionChunk

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


class OpenAIAdapter(BaseLLMAdapter):
    """
    Adapter for OpenAI's chat completion API.
    
    Supports GPT-4, GPT-4o, GPT-3.5-turbo, and other chat models.
    """
    
    provider_name = "openai"
    
    supported_models = [
        "gpt-4",
        "gpt-4-turbo",
        "gpt-4-turbo-preview",
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-3.5-turbo",
        "gpt-3.5-turbo-16k",
        "o1-preview",
        "o1-mini",
    ]
    
    default_model = "gpt-4o"
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize OpenAI adapter.
        
        Args:
            api_key: OpenAI API key (uses OPENAI_API_KEY env var if not provided)
        """
        self.api_key = api_key or settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY")
        self._client: Optional[AsyncOpenAI] = None
        self._validate_configuration()
    
    def _validate_configuration(self) -> None:
        """Validate OpenAI configuration."""
        if not self.api_key:
            logger.warning("OpenAI API key not configured")
    
    @property
    def client(self) -> AsyncOpenAI:
        """Get or create async OpenAI client."""
        if self._client is None:
            if not self.api_key:
                raise ValueError("OpenAI API key required")
            self._client = AsyncOpenAI(api_key=self.api_key)
        return self._client
    
    async def complete(
        self,
        messages: list[Message],
        config: Optional[LLMConfig] = None,
        context: Optional[str] = None,
    ) -> LLMResponse:
        """
        Generate a chat completion using OpenAI.
        
        Args:
            messages: Conversation messages
            config: LLM configuration
            context: RAL context to inject
            
        Returns:
            LLM response
        """
        config = config or LLMConfig(model=self.default_model)
        
        # Inject context if provided and enabled
        context_tokens = 0
        if context and config.inject_context:
            messages = self.inject_context(
                messages,
                context,
                config.context_position,
            )
            context_tokens = self.estimate_tokens(context)
        
        # Format messages for OpenAI
        formatted_messages = self.format_messages(messages)
        
        # Build request parameters
        params = self.get_provider_config(config)
        params["messages"] = formatted_messages
        
        logger.debug(
            "Making OpenAI completion request",
            model=config.model,
            message_count=len(messages),
            context_injected=bool(context),
        )
        
        try:
            response: ChatCompletion = await self.client.chat.completions.create(**params)
            
            # Extract response content
            choice = response.choices[0]
            content = choice.message.content or ""
            
            return LLMResponse(
                content=content,
                model=response.model,
                usage={
                    "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                    "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                    "total_tokens": response.usage.total_tokens if response.usage else 0,
                },
                finish_reason=choice.finish_reason,
                raw_response=response,
                context_injected=bool(context),
                context_tokens=context_tokens,
            )
            
        except Exception as e:
            logger.error("OpenAI completion failed", error=str(e))
            raise
    
    async def stream(
        self,
        messages: list[Message],
        config: Optional[LLMConfig] = None,
        context: Optional[str] = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        """
        Stream a chat completion using OpenAI.
        
        Args:
            messages: Conversation messages
            config: LLM configuration
            context: RAL context to inject
            
        Yields:
            Stream chunks
        """
        config = config or LLMConfig(model=self.default_model, stream=True)
        config.stream = True
        
        # Inject context if provided
        if context and config.inject_context:
            messages = self.inject_context(
                messages,
                context,
                config.context_position,
            )
        
        # Format messages
        formatted_messages = self.format_messages(messages)
        
        # Build request parameters
        params = self.get_provider_config(config)
        params["messages"] = formatted_messages
        
        logger.debug(
            "Making OpenAI streaming request",
            model=config.model,
            message_count=len(messages),
        )
        
        try:
            stream = await self.client.chat.completions.create(**params)
            
            async for chunk in stream:
                if chunk.choices:
                    choice = chunk.choices[0]
                    delta = choice.delta
                    
                    content = delta.content or ""
                    is_final = choice.finish_reason is not None
                    
                    yield StreamChunk(
                        content=content,
                        is_final=is_final,
                        finish_reason=choice.finish_reason,
                    )
                    
        except Exception as e:
            logger.error("OpenAI streaming failed", error=str(e))
            raise
    
    def format_messages(self, messages: list[Message]) -> list[dict]:
        """
        Format messages for OpenAI API.
        
        Args:
            messages: Standard messages
            
        Returns:
            OpenAI-formatted messages
        """
        formatted = []
        for msg in messages:
            message_dict = {
                "role": msg.role.value,
                "content": msg.content,
            }
            if msg.name:
                message_dict["name"] = msg.name
            formatted.append(message_dict)
        return formatted
    
    def get_provider_config(self, config: LLMConfig) -> dict:
        """
        Convert standard config to OpenAI format.
        
        Args:
            config: Standard configuration
            
        Returns:
            OpenAI API parameters
        """
        params = {
            "model": config.model,
            "temperature": config.temperature,
            "max_tokens": config.max_tokens,
            "top_p": config.top_p,
            "stream": config.stream,
            "presence_penalty": config.presence_penalty,
            "frequency_penalty": config.frequency_penalty,
        }
        
        if config.stop:
            params["stop"] = config.stop
        
        return params
    
    def estimate_tokens(self, text: str) -> int:
        """
        Estimate token count for OpenAI models.
        
        Uses a rough approximation. For accuracy, use tiktoken.
        
        Args:
            text: Text to estimate
            
        Returns:
            Estimated token count
        """
        # GPT models: roughly 4 chars per token for English
        # More conservative for mixed content
        return len(text) // 3
