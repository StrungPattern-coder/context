# RAL Python SDK

Context-aware AI augmentation for any AI provider.

## Installation

```bash
pip install ral-sdk
```

Or install from source:

```bash
pip install -e sdk/python/
```

## Quick Start

```python
from ral_sdk import RAL

# Initialize
ral = RAL(server_url="https://your-ral-server.com", user_id="user123")

# Augment a prompt
response = ral.augment("What should I do next?", provider="openai")

# Use with OpenAI
import openai

messages = [
    {"role": "system", "content": response.system_context},
    {"role": "user", "content": response.user_prompt}
]

completion = openai.chat.completions.create(
    model="gpt-4",
    messages=messages
)
```

## Usage with Different Providers

### OpenAI

```python
from ral_sdk import RAL, OpenAIHelper

ral = RAL(server_url="https://ral.example.com")
response = ral.augment("What's on my calendar?", provider="openai")

messages = OpenAIHelper.build_messages(response)
# Use with openai.chat.completions.create()
```

### Anthropic Claude

```python
from ral_sdk import RAL, AnthropicHelper

ral = RAL(server_url="https://ral.example.com")
response = ral.augment("Help me plan my day", provider="anthropic")

request = AnthropicHelper.build_request(response)
# Use with anthropic.messages.create()
```

### Google Gemini

```python
from ral_sdk import RAL, GoogleHelper

ral = RAL(server_url="https://ral.example.com")
response = ral.augment("What's the weather like?", provider="google")

contents = GoogleHelper.build_contents(response)
# Use with model.generate_content()
```

## Environment Variables

- `RAL_SERVER_URL`: Default RAL server URL
- `RAL_USER_ID`: Default user identifier

## CLI Usage

```bash
# Check server health
ral --server https://ral.example.com --health

# Get current context
ral --server https://ral.example.com --context

# Augment a prompt
ral --server https://ral.example.com "What should I do today?"
```

## API Reference

### RAL Class

```python
RAL(
    server_url: str,        # RAL server URL
    user_id: str = None,    # User identifier
    timeout: int = 30,      # Request timeout
    auto_detect: bool = True # Auto-detect context signals
)
```

### augment()

```python
ral.augment(
    prompt: str,                    # User's prompt
    provider: str = "generic",      # AI provider
    signals: ContextSignals = None, # Context signals
    include_temporal: bool = True,  # Include time context
    include_spatial: bool = True,   # Include location context
    include_preferences: bool = True # Include user preferences
) -> RALResponse
```

### RALResponse

```python
@dataclass
class RALResponse:
    system_context: str      # System prompt with context
    user_prompt: str         # Processed user prompt
    augmented_prompt: str    # Combined prompt (optional)
    metadata: dict           # Additional metadata
```

## License

MIT
