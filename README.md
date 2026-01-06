# Reality Anchoring Layer (RAL)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](https://github.com/raldev/ral/releases)

**The context layer LLMs can't access.**

RAL is a browser extension that gives AI systems awareness of your real-world reality - what you're looking at, what you've copied, what you're struggling with, and what you're researching across tabs.

> **Version 1.0.0** - First stable release. "Extreme Intelligence Engine" is production-ready.

---

## 🎯 What is RAL?

Reality Anchoring Layer is infrastructure that:

- **Maintains** a user's temporal, spatial, and situational context
- **Reasons** about that context semantically
- **Resolves** ambiguous human references ("today", "now", "here")
- **Injects** minimal required context into LLM prompts
- **Works** across sessions, devices, and AI providers
- **Gives users** full visibility and control

Think of it as **Auth0 for context** or **Segment for reality awareness**.

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Client Apps    │────▶│   RAL Core API  │────▶│  LLM Providers  │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
    ┌────▼────┐            ┌─────▼─────┐           ┌─────▼─────┐
    │Temporal │            │  Context  │           │  Prompt   │
    │ Engine  │            │  Memory   │           │Composition│
    └─────────┘            └───────────┘           └───────────┘
```

See [Architecture Documentation](docs/ARCHITECTURE.md) for full details.

---

## 🚀 Quick Start

### Option 1: Browser Extension (Fastest - No Server Required)

```bash
# 1. Load the extension in Chrome
# Go to chrome://extensions → Enable Developer Mode → Load Unpacked → Select /extension folder

# 2. That's it! The extension works standalone with local context processing
```

Supports: ChatGPT, Claude, Gemini, Perplexity, Poe, HuggingChat, Local LLMs (Ollama)

### Option 2: One-Click Docker Deployment

```bash
# Full production stack
./scripts/deploy.sh deploy

# Development mode (dependencies only)
./scripts/deploy.sh dev

# View logs
./scripts/deploy.sh logs
```

### Option 3: Local Development

```bash
# Start infrastructure
docker compose -f docker/docker-compose.yml up -d db redis

# Setup Python environment
cd services/ral-core
poetry install

# Run database migrations
poetry run alembic upgrade head

# Start the API server
poetry run uvicorn app.main:app --reload --port 8000
```

Services will be available at:
- RAL Core API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Universal Endpoint: http://localhost:8000/api/v0/universal/augment

---

## Hybrid Architecture

RAL supports three operating modes:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Local** | All processing in browser | Privacy-first, offline |
| **Hybrid** | Local + server sync | Best of both worlds |
| **Server** | Full server processing | Team/enterprise features |

```
┌─────────────────────────────────────────────────────────────┐
│                     RAL Hybrid System                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐                    ┌─────────────┐        │
│  │   Browser   │◄──────────────────►│  RAL Server │        │
│  │  Extension  │   Sync (Optional)  │   (API)     │        │
│  └─────────────┘                    └─────────────┘        │
│        │                                   │               │
│        ▼                                   ▼               │
│  ┌─────────────┐                    ┌─────────────┐        │
│  │ Local RAL   │                    │ Universal   │        │
│  │  Engine     │                    │  Endpoint   │        │
│  └─────────────┘                    └─────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## SDKs

### Python SDK

```bash
pip install ral-sdk
```

```python
from ral_sdk import RAL

ral = RAL(server_url="https://ral.example.com")
response = ral.augment("What should I focus on?", provider="openai")

# Use with any AI client
messages = [
    {"role": "system", "content": response.system_context},
    {"role": "user", "content": response.user_prompt}
]
```

### JavaScript SDK

```bash
npm install ral-sdk
```

```typescript
import { RAL } from 'ral-sdk';

const ral = new RAL({ serverUrl: 'https://ral.example.com' });
const response = await ral.augment('What should I focus on?', { provider: 'openai' });
```

---

## Project Structure

```
ral/
├── docs/                          # Documentation
│   ├── PHILOSOPHY.md              # Design philosophy
│   ├── ARCHITECTURE.md            # System architecture
│   └── API.md                     # API reference
│
├── services/                      # Backend services
│   └── ral-core/                  # Core RAL service
│       ├── app/
│       │   ├── api/               # API endpoints
│       │   ├── core/              # Core configuration
│       │   ├── engines/           # Context engines
│       │   ├── models/            # Data models
│       │   ├── services/          # Business logic
│       │   └── adapters/          # LLM adapters
│       ├── tests/                 # Test suite
│       └── alembic/               # Database migrations
│
├── dashboard/                     # Web dashboard (React)
│   ├── src/
│   │   ├── components/            # UI components
│   │   ├── pages/                 # Page components
│   │   ├── services/              # API clients
│   │   └── types/                 # TypeScript types
│   └── public/                    # Static assets
│
├── sdks/                          # Client SDKs
│   ├── python/                    # Python SDK
│   └── javascript/                # JavaScript/TypeScript SDK
│
├── infrastructure/                # Infrastructure as code
│   ├── docker/                    # Docker configurations
│   ├── kubernetes/                # K8s manifests
│   └── terraform/                 # Cloud provisioning
│
└── docker-compose.yml             # Local development setup
```

---

## 🔧 Core Features

### Context Types

| Type | Description |
|------|-------------|
| **Temporal** | Time, date, timezone, relative references |
| **Spatial** | Location, locale, cultural defaults |
| **Situational** | Ongoing tasks, conversation continuity |
| **Meta** | Confidence scores, freshness, source |

### Key Capabilities

- ✅ Timezone-aware temporal reasoning
- ✅ Ambiguous reference resolution ("today", "now", "earlier")
- ✅ Confidence-scored assumptions
- ✅ Context decay and freshness tracking
- ✅ Drift and conflict detection
- ✅ Minimal prompt injection
- ✅ User control dashboard
- ✅ Multi-tenant architecture
- ✅ Model-agnostic design

---

## API Examples

### Anchor Context

```bash
curl -X POST http://localhost:8000/v1/context/anchor \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "signals": {
      "timestamp": "2026-01-03T16:12:00+05:30",
      "locale": "en-IN"
    },
    "message": "Remind me about the meeting tomorrow"
  }'
```

### Compose Prompt

```bash
curl -X POST http://localhost:8000/v1/prompt/compose \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "original_prompt": "What should I do today?",
    "provider": "openai"
  }'
```

---

## Security

- JWT-based authentication
- Tenant isolation
- Encryption at rest and in transit
- Audit logging
- GDPR-compliant data handling

---

## Documentation

- [Philosophy & Design](docs/PHILOSOPHY.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [SDK Documentation](sdks/README.md)
- [Deployment Guide](infrastructure/README.md)

---

## Testing

```bash
# Run all tests
cd services/ral-core
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test module
pytest tests/engines/test_temporal.py
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

Built with the belief that AI should understand human reality, not require humans to explain it repeatedly.
