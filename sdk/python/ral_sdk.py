"""
RAL Python SDK - Universal Integration

A simple, lightweight Python SDK for integrating RAL with any AI provider.
Works with OpenAI, Anthropic, Google, Cohere, Mistral, and local models.

Usage:
    from ral_sdk import RAL
    
    ral = RAL(server_url="https://your-ral-server.com")
    
    # With OpenAI
    augmented = ral.augment("What should I do next?", provider="openai")
    response = openai.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": augmented.system_context},
            {"role": "user", "content": augmented.user_prompt}
        ]
    )
"""

from __future__ import annotations

import os
import time
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Optional, Literal
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

__version__ = "0.1.0"
__all__ = ["RAL", "RALResponse", "RALError", "ContextSignals"]

logger = logging.getLogger(__name__)

# ========================================
# Types
# ========================================

Provider = Literal[
    "openai", "anthropic", "google", "perplexity", 
    "cohere", "mistral", "llama", "generic"
]


@dataclass
class ContextSignals:
    """Contextual signals for RAL augmentation."""
    timezone: Optional[str] = None
    locale: Optional[str] = None
    location: Optional[str] = None
    device: Optional[str] = None
    session_context: Optional[str] = None
    
    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in self.__dict__.items() if v is not None}


@dataclass
class RALResponse:
    """Response from RAL augmentation."""
    system_context: str
    user_prompt: str
    augmented_prompt: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RALResponse:
        return cls(
            system_context=data.get("system_context", ""),
            user_prompt=data.get("user_prompt", ""),
            augmented_prompt=data.get("augmented_prompt"),
            metadata=data.get("metadata", {})
        )


class RALError(Exception):
    """RAL SDK Error."""
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


# ========================================
# Main SDK Class
# ========================================

class RAL:
    """
    RAL SDK - Context-aware AI augmentation.
    
    Args:
        server_url: RAL server URL (or set RAL_SERVER_URL env var)
        user_id: User identifier for personalization (or set RAL_USER_ID env var)
        timeout: Request timeout in seconds
        auto_detect: Automatically detect contextual signals
    
    Example:
        >>> ral = RAL(server_url="https://ral.example.com", user_id="user123")
        >>> response = ral.augment("What's my schedule?", provider="openai")
        >>> print(response.system_context)
    """
    
    def __init__(
        self,
        server_url: Optional[str] = None,
        user_id: Optional[str] = None,
        timeout: int = 30,
        auto_detect: bool = True
    ):
        self.server_url = (server_url or os.getenv("RAL_SERVER_URL", "")).rstrip("/")
        self.user_id = user_id or os.getenv("RAL_USER_ID", "default")
        self.timeout = timeout
        self.auto_detect = auto_detect
        self._signals_cache: Optional[ContextSignals] = None
        
        if not self.server_url:
            raise RALError("server_url is required (or set RAL_SERVER_URL env var)")
    
    def augment(
        self,
        prompt: str,
        provider: Provider = "generic",
        signals: Optional[ContextSignals] = None,
        include_temporal: bool = True,
        include_spatial: bool = True,
        include_preferences: bool = True
    ) -> RALResponse:
        """
        Augment a prompt with contextual awareness.
        
        Args:
            prompt: The user's original prompt
            provider: AI provider for format optimization
            signals: Contextual signals (auto-detected if not provided)
            include_temporal: Include time-based context
            include_spatial: Include location-based context
            include_preferences: Include user preferences
        
        Returns:
            RALResponse with augmented context
        """
        # Auto-detect signals if not provided
        if signals is None and self.auto_detect:
            signals = self._detect_signals()
        
        # Build request
        payload = {
            "prompt": prompt,
            "user_id": self.user_id,
            "provider": provider,
            "signals": signals.to_dict() if signals else {},
            "options": {
                "include_temporal": include_temporal,
                "include_spatial": include_spatial,
                "include_preferences": include_preferences
            }
        }
        
        # Make request
        data = self._request("POST", "/api/v0/universal/augment", payload)
        return RALResponse.from_dict(data)
    
    def get_context(
        self,
        signals: Optional[ContextSignals] = None
    ) -> dict[str, Any]:
        """
        Get current context without augmentation.
        
        Useful for debugging or displaying context to users.
        """
        if signals is None and self.auto_detect:
            signals = self._detect_signals()
        
        params = f"?user_id={self.user_id}"
        if signals:
            if signals.timezone:
                params += f"&timezone={signals.timezone}"
            if signals.location:
                params += f"&location={signals.location}"
        
        return self._request("GET", f"/api/v0/universal/context{params}")
    
    def health_check(self) -> bool:
        """Check if RAL server is healthy."""
        try:
            data = self._request("GET", "/health")
            return data.get("status") == "healthy"
        except RALError:
            return False
    
    def _detect_signals(self) -> ContextSignals:
        """Auto-detect contextual signals."""
        if self._signals_cache:
            return self._signals_cache
        
        import locale
        
        signals = ContextSignals()
        
        # Timezone
        try:
            signals.timezone = time.tzname[0]
        except Exception:
            pass
        
        # Locale
        try:
            signals.locale = locale.getdefaultlocale()[0] or "en_US"
        except Exception:
            signals.locale = "en_US"
        
        # Device info
        import platform
        signals.device = f"{platform.system()} {platform.release()}"
        
        self._signals_cache = signals
        return signals
    
    def _request(
        self,
        method: str,
        endpoint: str,
        payload: Optional[dict] = None
    ) -> dict[str, Any]:
        """Make HTTP request to RAL server."""
        url = f"{self.server_url}{endpoint}"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": f"RAL-Python-SDK/{__version__}",
            "X-RAL-User-ID": self.user_id
        }
        
        data = json.dumps(payload).encode() if payload else None
        
        try:
            request = Request(url, data=data, headers=headers, method=method)
            with urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read().decode())
        except HTTPError as e:
            body = e.read().decode() if e.fp else ""
            raise RALError(f"HTTP {e.code}: {body}", status_code=e.code)
        except URLError as e:
            raise RALError(f"Connection error: {e.reason}")
        except json.JSONDecodeError as e:
            raise RALError(f"Invalid JSON response: {e}")


# ========================================
# Provider-Specific Helpers
# ========================================

class OpenAIHelper:
    """Helper for OpenAI integration."""
    
    @staticmethod
    def build_messages(
        response: RALResponse,
        history: Optional[list[dict]] = None
    ) -> list[dict[str, str]]:
        """Build OpenAI messages array with RAL context."""
        messages = [{"role": "system", "content": response.system_context}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": response.user_prompt})
        return messages


class AnthropicHelper:
    """Helper for Anthropic Claude integration."""
    
    @staticmethod
    def build_request(
        response: RALResponse,
        model: str = "claude-3-opus-20240229",
        max_tokens: int = 4096,
        history: Optional[list[dict]] = None
    ) -> dict[str, Any]:
        """Build Anthropic API request with RAL context."""
        messages = []
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": response.user_prompt})
        
        return {
            "model": model,
            "max_tokens": max_tokens,
            "system": response.system_context,
            "messages": messages
        }


class GoogleHelper:
    """Helper for Google Gemini integration."""
    
    @staticmethod
    def build_contents(
        response: RALResponse,
        history: Optional[list[dict]] = None
    ) -> list[dict[str, Any]]:
        """Build Google Gemini contents with RAL context."""
        contents = []
        
        # Add system context as first user message
        contents.append({
            "role": "user",
            "parts": [{"text": f"System context: {response.system_context}"}]
        })
        contents.append({
            "role": "model",
            "parts": [{"text": "I understand the context. How can I help you?"}]
        })
        
        # Add history
        if history:
            for msg in history:
                role = "user" if msg.get("role") == "user" else "model"
                contents.append({
                    "role": role,
                    "parts": [{"text": msg.get("content", "")}]
                })
        
        # Add current message
        contents.append({
            "role": "user",
            "parts": [{"text": response.user_prompt}]
        })
        
        return contents


# ========================================
# Convenience Functions
# ========================================

def quick_augment(
    prompt: str,
    provider: Provider = "generic",
    server_url: Optional[str] = None
) -> RALResponse:
    """
    Quick one-liner augmentation.
    
    Example:
        >>> from ral_sdk import quick_augment
        >>> result = quick_augment("What should I do today?", provider="openai")
    """
    ral = RAL(server_url=server_url)
    return ral.augment(prompt, provider=provider)


# ========================================
# CLI
# ========================================

def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="RAL SDK CLI")
    parser.add_argument("prompt", nargs="?", help="Prompt to augment")
    parser.add_argument("--server", "-s", help="RAL server URL")
    parser.add_argument("--provider", "-p", default="generic", help="AI provider")
    parser.add_argument("--user", "-u", help="User ID")
    parser.add_argument("--health", action="store_true", help="Check server health")
    parser.add_argument("--context", action="store_true", help="Show current context")
    
    args = parser.parse_args()
    
    try:
        ral = RAL(server_url=args.server, user_id=args.user)
        
        if args.health:
            healthy = ral.health_check()
            print(f"Server health: {'✓ healthy' if healthy else '✗ unhealthy'}")
            return 0 if healthy else 1
        
        if args.context:
            context = ral.get_context()
            print(json.dumps(context, indent=2))
            return 0
        
        if not args.prompt:
            parser.print_help()
            return 1
        
        response = ral.augment(args.prompt, provider=args.provider)
        print(f"\n=== System Context ===\n{response.system_context}")
        print(f"\n=== User Prompt ===\n{response.user_prompt}")
        if response.augmented_prompt:
            print(f"\n=== Augmented ===\n{response.augmented_prompt}")
        return 0
        
    except RALError as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(main())
