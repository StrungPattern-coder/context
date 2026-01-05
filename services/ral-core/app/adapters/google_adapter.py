"""
Google AI Adapter

Adapter for Google's Gemini models.
"""

from collections.abc import AsyncGenerator
from typing import Any, Optional
import os

import structlog
import httpx

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


class GoogleAdapter(BaseLLMAdapter):
    """
    Adapter for Google's Gemini API.
    
    Supports Gemini Pro, Gemini Ultra, and other models.
    """
    
    provider_name = "google"
    
    supported_models = [
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-1.0-pro",
        "gemini-pro",
        "gemini-pro-vision",
    ]
    
    default_model = "gemini-1.5-pro"
    
    # API endpoint
    BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Google AI adapter.
        
        Args:
            api_key: Google AI API key (uses GOOGLE_API_KEY env var if not provided)
        """
        self.api_key = api_key or settings.GOOGLE_API_KEY or os.getenv("GOOGLE_API_KEY")
        self._client: Optional[httpx.AsyncClient] = None
        self._validate_configuration()
    
    def _validate_configuration(self) -> None:
        """Validate Google configuration."""
        if not self.api_key:
            logger.warning("Google AI API key not configured")
    
    @property
    def client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=60.0)
        return self._client
    
    async def complete(
        self,
        messages: list[Message],
        config: Optional[LLMConfig] = None,
        context: Optional[str] = None,
    ) -> LLMResponse:
        """
        Generate content using Gemini.
        
        Args:
            messages: Conversation messages
            config: LLM configuration
            context: RAL context to inject
            
        Returns:
            LLM response
        """
        config = config or LLMConfig(model=self.default_model)
        
        if not self.api_key:
            raise ValueError("Google AI API key required")
        
        # Extract system instruction and inject context
        system_instruction = ""
        context_tokens = 0
        
        # Get existing system message
        content_messages = []
        for msg in messages:
            if msg.role == MessageRole.SYSTEM:
                system_instruction = msg.content
            else:
                content_messages.append(msg)
        
        # Inject RAL context into system instruction
        if context and config.inject_context:
            if system_instruction:
                system_instruction = f"{context}\n\n{system_instruction}"
            else:
                system_instruction = context
            context_tokens = self.estimate_tokens(context)
        
        # Format messages for Gemini
        contents = self.format_messages(content_messages)
        
        # Build request body
        body = {
            "contents": contents,
            "generationConfig": self.get_provider_config(config),
        }
        
        if system_instruction:
            body["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }
        
        # Make request
        url = f"{self.BASE_URL}/models/{config.model}:generateContent?key={self.api_key}"
        
        logger.debug(
            "Making Google AI completion request",
            model=config.model,
            message_count=len(content_messages),
            context_injected=bool(context),
        )
        
        try:
            response = await self.client.post(url, json=body)
            response.raise_for_status()
            data = response.json()
            
            # Extract response content
            content = ""
            if "candidates" in data and data["candidates"]:
                candidate = data["candidates"][0]
                if "content" in candidate and "parts" in candidate["content"]:
                    for part in candidate["content"]["parts"]:
                        if "text" in part:
                            content += part["text"]
            
            # Extract usage
            usage = {}
            if "usageMetadata" in data:
                usage = {
                    "prompt_tokens": data["usageMetadata"].get("promptTokenCount", 0),
                    "completion_tokens": data["usageMetadata"].get("candidatesTokenCount", 0),
                    "total_tokens": data["usageMetadata"].get("totalTokenCount", 0),
                }
            
            # Get finish reason
            finish_reason = None
            if "candidates" in data and data["candidates"]:
                finish_reason = data["candidates"][0].get("finishReason")
            
            return LLMResponse(
                content=content,
                model=config.model,
                usage=usage,
                finish_reason=finish_reason,
                raw_response=data,
                context_injected=bool(context),
                context_tokens=context_tokens,
            )
            
        except httpx.HTTPError as e:
            logger.error("Google AI completion failed", error=str(e))
            raise
    
    async def stream(
        self,
        messages: list[Message],
        config: Optional[LLMConfig] = None,
        context: Optional[str] = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        """
        Stream content using Gemini.
        
        Args:
            messages: Conversation messages
            config: LLM configuration
            context: RAL context to inject
            
        Yields:
            Stream chunks
        """
        config = config or LLMConfig(model=self.default_model, stream=True)
        
        if not self.api_key:
            raise ValueError("Google AI API key required")
        
        # Extract system instruction
        system_instruction = ""
        content_messages = []
        for msg in messages:
            if msg.role == MessageRole.SYSTEM:
                system_instruction = msg.content
            else:
                content_messages.append(msg)
        
        if context and config.inject_context:
            if system_instruction:
                system_instruction = f"{context}\n\n{system_instruction}"
            else:
                system_instruction = context
        
        # Format messages
        contents = self.format_messages(content_messages)
        
        # Build request body
        body = {
            "contents": contents,
            "generationConfig": self.get_provider_config(config),
        }
        
        if system_instruction:
            body["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }
        
        # Make streaming request
        url = f"{self.BASE_URL}/models/{config.model}:streamGenerateContent?key={self.api_key}&alt=sse"
        
        logger.debug(
            "Making Google AI streaming request",
            model=config.model,
            message_count=len(content_messages),
        )
        
        try:
            async with self.client.stream("POST", url, json=body) as response:
                response.raise_for_status()
                
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        import json
                        data = json.loads(line[6:])
                        
                        content = ""
                        if "candidates" in data and data["candidates"]:
                            candidate = data["candidates"][0]
                            if "content" in candidate and "parts" in candidate["content"]:
                                for part in candidate["content"]["parts"]:
                                    if "text" in part:
                                        content += part["text"]
                        
                        finish_reason = None
                        is_final = False
                        if "candidates" in data and data["candidates"]:
                            finish_reason = data["candidates"][0].get("finishReason")
                            is_final = finish_reason is not None
                        
                        yield StreamChunk(
                            content=content,
                            is_final=is_final,
                            finish_reason=finish_reason,
                        )
                        
        except httpx.HTTPError as e:
            logger.error("Google AI streaming failed", error=str(e))
            raise
    
    def format_messages(self, messages: list[Message]) -> list[dict]:
        """
        Format messages for Gemini API.
        
        Args:
            messages: Standard messages (excluding system)
            
        Returns:
            Gemini-formatted contents
        """
        contents = []
        
        for msg in messages:
            role = msg.role.value
            if role == "system":
                continue  # System handled separately
            
            # Map roles to Gemini format
            gemini_role = "user" if role == "user" else "model"
            
            contents.append({
                "role": gemini_role,
                "parts": [{"text": msg.content}],
            })
        
        return contents
    
    def get_provider_config(self, config: LLMConfig) -> dict:
        """
        Convert standard config to Gemini format.
        
        Args:
            config: Standard configuration
            
        Returns:
            Gemini generation config
        """
        generation_config = {
            "temperature": config.temperature,
            "maxOutputTokens": config.max_tokens,
            "topP": config.top_p,
        }
        
        if config.stop:
            generation_config["stopSequences"] = config.stop
        
        return generation_config
    
    def estimate_tokens(self, text: str) -> int:
        """
        Estimate token count for Gemini models.
        
        Args:
            text: Text to estimate
            
        Returns:
            Estimated token count
        """
        # Gemini uses SentencePiece tokenizer
        return len(text) // 4
