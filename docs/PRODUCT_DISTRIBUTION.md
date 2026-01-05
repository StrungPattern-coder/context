# RAL Product Distribution & Integration Architecture

**Version: 0.1.0** (Pre-release)  
**Status: Core Complete, Packaging Phase**  
**Date: January 2026**

---

## 1. Product North Star

### What RAL Is

RAL is **invisible context infrastructure** for AI systems.

It is NOT:
- A chatbot
- A UI wrapper around LLMs
- A replacement for ChatGPT/Claude/Gemini
- A general-purpose AI platform

It IS:
- A context intelligence layer that sits between users and ANY AI
- Infrastructure that makes every AI interaction reality-aware
- A thin middleware that augments, never replaces

### The One-Sentence Promise

> "Install once. Every AI you use becomes aware of your reality."

### Core Guarantees (Never Compromise)

| Guarantee | What It Means |
|-----------|---------------|
| **Deterministic** | Same inputs → same context resolution |
| **Minimal** | Only inject context that affects the output |
| **Private** | User controls all context, nothing leaves without consent |
| **Trustworthy** | No hallucinated context, ever |
| **AI-Agnostic** | Works with any LLM, any provider, any tool |

---

## 2. Canonical Distribution Unit

### Primary Primitive: **Self-Hosted Docker Container**

```bash
docker run -d -p 8765:8765 raldev/ral:0.1
```

**Justification:**
1. **Universal** - Runs on any machine (Mac, Linux, Windows, cloud)
2. **Private** - Data never leaves user's machine
3. **Deterministic** - Same behavior everywhere
4. **No vendor lock-in** - User owns their instance
5. **Developer-friendly** - Familiar paradigm

### Mental Model

| Concept | Definition |
|---------|------------|
| **Install** | `docker run raldev/ral` or `pip install ral` |
| **Use** | Point any AI tool at `localhost:8765` |
| **Configure** | Set timezone, location preferences once |
| **Forget** | RAL works invisibly after setup |

### Distribution Tiers

```
┌─────────────────────────────────────────────────────────────────┐
│                     DISTRIBUTION TIERS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tier 1: Self-Hosted (Primary)                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ docker run -d -p 8765:8765 raldev/ral:0.1               │   │
│  │ → Zero-config local instance                             │   │
│  │ → SQLite for single user                                 │   │
│  │ → All data stays local                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Tier 2: Python Package                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ pip install ral                                          │   │
│  │ ral start                                                │   │
│  │ → For developers embedding RAL                           │   │
│  │ → Programmatic access                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Tier 3: Managed Cloud (Future)                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Sign up at ral.dev                                       │   │
│  │ → Multi-tenant SaaS                                      │   │
│  │ → Team/org features                                      │   │
│  │ → Zero infrastructure                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Public API Contract (v0.1 - LOCKED)

### Base URL

```
Local:   http://localhost:8765/api/v0
Cloud:   https://api.ral.dev/v0
```

### Authentication

```http
Authorization: Bearer <api_key>
X-RAL-User-ID: <user_id>
```

For local single-user mode, authentication is optional.

---

### Endpoint: POST /context/resolve

**Purpose:** Resolve ambiguous references in user input to concrete values.

**When to use:** Before sending user message to any AI.

```http
POST /api/v0/context/resolve
Content-Type: application/json
```

**Request:**
```json
{
  "user_id": "user_123",
  "message": "What time is the meeting today?",
  "signals": {
    "timestamp": "2026-01-04T14:30:00Z",
    "timezone": "America/New_York",
    "locale": "en-US"
  }
}
```

**Response:**
```json
{
  "resolve_id": "res_abc123",
  "resolved": {
    "today": {
      "value": "2026-01-04",
      "display": "Saturday, January 4th, 2026",
      "confidence": 1.0,
      "source": "explicit_signal"
    }
  },
  "context_snapshot": {
    "temporal": {
      "current_time": "14:30 EST",
      "day_of_week": "Saturday",
      "is_weekend": true
    }
  },
  "warnings": []
}
```

**Guarantees:**
- Deterministic: Same input → same resolution
- Fast: <50ms p99 latency
- Safe: Never hallucinates dates/times

**Failure Behavior:**
- Missing timezone → use UTC + warning
- Invalid timestamp → reject with 400
- Unknown reference → return unresolved + warning

---

### Endpoint: POST /prompt/augment

**Purpose:** Augment a user prompt with minimal required context for any LLM.

**When to use:** Before every LLM API call.

```http
POST /api/v0/prompt/augment
Content-Type: application/json
```

**Request:**
```json
{
  "user_id": "user_123",
  "prompt": "Remind me about the deadline",
  "provider": "openai",
  "options": {
    "max_context_tokens": 200,
    "injection_style": "system_prompt",
    "include_types": ["temporal", "situational"]
  }
}
```

**Response:**
```json
{
  "augment_id": "aug_xyz789",
  "system_context": "Current context for this user:\n- Current time: Saturday, January 4, 2026, 2:30 PM EST\n- Location: New York, USA\n- It is a weekend",
  "user_message": "Remind me about the deadline",
  "metadata": {
    "provider": "openai",
    "context_tokens": 42,
    "contexts_included": 3,
    "contexts_excluded": 0,
    "injection_style": "system_prompt"
  },
  "decisions": [
    {"type": "temporal", "included": true, "reason": "contains_time_reference"},
    {"type": "spatial", "included": false, "reason": "no_location_reference"}
  ]
}
```

**Guarantees:**
- Minimal: Only includes context that affects output
- Provider-aware: Formats for target LLM
- Transparent: Explains every inclusion decision

**Failure Behavior:**
- No context available → return original prompt unchanged
- Provider unknown → use generic format
- Token limit exceeded → prioritize by relevance

---

### Endpoint: GET /context/snapshot

**Purpose:** Get current context state for a user (for inspection/debugging).

```http
GET /api/v0/context/snapshot?user_id=user_123
```

**Response:**
```json
{
  "user_id": "user_123",
  "snapshot_time": "2026-01-04T14:30:00Z",
  "temporal": {
    "timezone": "America/New_York",
    "current_time": "2026-01-04T14:30:00-05:00",
    "day_part": "afternoon",
    "is_weekend": true,
    "confidence": 1.0
  },
  "spatial": {
    "country": "US",
    "region": "New York",
    "city": "New York",
    "confidence": 0.85
  },
  "situational": {
    "active_project": null,
    "session_type": "general",
    "confidence": 0.5
  },
  "meta": {
    "total_contexts": 8,
    "last_updated": "2026-01-04T14:25:00Z",
    "drift_status": "stable"
  }
}
```

**Guarantees:**
- Real-time: Reflects current state
- Complete: All context types included
- Read-only: No side effects

---

### Endpoint: GET /drift/status

**Purpose:** Check for context drift and staleness.

```http
GET /api/v0/drift/status?user_id=user_123
```

**Response:**
```json
{
  "user_id": "user_123",
  "overall_status": "stable",
  "drift_score": 0.12,
  "contexts": [
    {
      "type": "temporal",
      "status": "stable",
      "drift_score": 0.0,
      "last_confirmed": "2026-01-04T14:30:00Z"
    },
    {
      "type": "spatial",
      "status": "drifting",
      "drift_score": 0.35,
      "last_confirmed": "2026-01-03T10:00:00Z",
      "recommendation": "confirm_location"
    }
  ],
  "recommendations": [
    {
      "action": "confirm_location",
      "reason": "Location not confirmed in 24+ hours",
      "priority": "low"
    }
  ]
}
```

**Guarantees:**
- Proactive: Detects drift before it causes errors
- Actionable: Provides specific recommendations
- Non-blocking: Never forces user interaction

---

### Endpoint: POST /context/update

**Purpose:** Explicitly update context (user-initiated).

```http
POST /api/v0/context/update
Content-Type: application/json
```

**Request:**
```json
{
  "user_id": "user_123",
  "updates": [
    {
      "type": "spatial",
      "key": "city",
      "value": "San Francisco",
      "source": "user_explicit"
    }
  ]
}
```

**Response:**
```json
{
  "updated": 1,
  "contexts": [
    {
      "type": "spatial",
      "key": "city",
      "old_value": "New York",
      "new_value": "San Francisco",
      "confidence": 1.0
    }
  ]
}
```

---

### API Versioning Rules

| Rule | Description |
|------|-------------|
| **URL versioning** | `/api/v0`, `/api/v1`, etc. |
| **No breaking changes** | Within a major version |
| **Deprecation** | 6-month warning before removal |
| **Additive only** | New fields OK, removing fields requires new version |

---

## 4. One-Click Deployment Paths

### A. Individual User (Student/Dev)

**Goal:** Working RAL in under 60 seconds, zero config.

**Option 1: Docker (Recommended)**
```bash
# One command, that's it
docker run -d -p 8765:8765 --name ral raldev/ral:0.1

# Verify
curl http://localhost:8765/health
# → {"status": "healthy", "version": "0.1.0"}
```

**What happens automatically:**
- SQLite database created in container
- Default single-user mode (no auth required)
- Timezone auto-detected from system
- Ready to receive requests immediately

**Option 2: Python Package**
```bash
pip install ral
ral start

# Or with custom port
ral start --port 9000
```

**Option 3: Browser Extension Only**
1. Install RAL extension from Chrome/Firefox store
2. Extension runs embedded micro-RAL
3. No server setup required

---

### B. Team/Organization

**Goal:** Shared RAL instance with multi-tenancy.

```bash
# Clone deployment repo
git clone https://github.com/raldev/ral-deploy
cd ral-deploy

# Configure
cp .env.example .env
# Edit .env with your settings:
# - DATABASE_URL=postgres://...
# - ADMIN_EMAIL=admin@company.com
# - ENABLE_MULTI_TENANT=true

# Deploy
docker-compose up -d

# Create admin
docker exec ral ral-admin create-tenant "My Company"
```

**Features enabled:**
- PostgreSQL for durability
- Multi-tenant isolation
- Admin dashboard at `/admin`
- User management
- API key management

**Required config:**
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | sqlite | PostgreSQL connection |
| `SECRET_KEY` | generated | JWT signing key |
| `ADMIN_EMAIL` | none | First admin account |
| `ENABLE_AUTH` | true | Require authentication |

---

### C. Developer Embedding RAL

**Goal:** Programmatic integration, no UI.

**Python:**
```python
# pip install ral-client
from ral import RALClient

ral = RALClient(base_url="http://localhost:8765")

# Before sending to any LLM
augmented = ral.augment(
    user_id="user_123",
    prompt="What's the weather like today?",
    provider="openai"
)

# Use augmented.system_context and augmented.user_message
openai_response = openai.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": augmented.system_context},
        {"role": "user", "content": augmented.user_message}
    ]
)
```

**JavaScript:**
```javascript
// npm install @ral/client
import { RALClient } from '@ral/client';

const ral = new RALClient({ baseUrl: 'http://localhost:8765' });

const { systemContext, userMessage } = await ral.augment({
  userId: 'user_123',
  prompt: 'Schedule a meeting for tomorrow',
  provider: 'anthropic'
});
```

---

## 5. Universal Integration Architecture

### The Interception Model

RAL integrates via **prompt interception**, not model replacement.

```
┌─────────────────────────────────────────────────────────────────┐
│                     INTEGRATION PATTERN                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   User Input                                                    │
│       │                                                         │
│       ▼                                                         │
│   ┌───────────┐                                                 │
│   │ RAL Client│ ◄── Browser Extension / SDK / Proxy            │
│   └─────┬─────┘                                                 │
│         │                                                       │
│         ▼                                                       │
│   ┌───────────┐      ┌───────────┐                              │
│   │ RAL Core  │ ────▶│  Context  │                              │
│   │   API     │      │  Memory   │                              │
│   └─────┬─────┘      └───────────┘                              │
│         │                                                       │
│         ▼                                                       │
│   ┌───────────────────────────────┐                             │
│   │ Augmented Prompt              │                             │
│   │ = Context + Original Message  │                             │
│   └───────────────┬───────────────┘                             │
│                   │                                             │
│         ┌─────────┼─────────┬─────────┐                         │
│         ▼         ▼         ▼         ▼                         │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│   │ ChatGPT │ │ Claude  │ │ Gemini  │ │ Local   │              │
│   │         │ │         │ │         │ │ LLM     │              │
│   └─────────┘ └─────────┘ └─────────┘ └─────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Methods by Platform

#### 1. ChatGPT Web Interface
**Method:** Browser extension injects context into message box

```javascript
// Extension intercepts before send
const originalMessage = document.querySelector('textarea').value;
const { systemContext } = await ral.augment({ prompt: originalMessage });

// Prepend context to message (ChatGPT doesn't have system prompt)
const augmentedMessage = `[Context: ${systemContext}]\n\n${originalMessage}`;
```

#### 2. Claude Web Interface
**Method:** Same browser extension, different injection format

```javascript
// Claude-specific formatting
const augmentedMessage = `<context>\n${systemContext}\n</context>\n\n${originalMessage}`;
```

#### 3. API Integrations (OpenAI, Anthropic, Google)
**Method:** SDK wrapper or direct API augmentation

```python
# OpenAI
from openai import OpenAI
from ral import RALClient

client = OpenAI()
ral = RALClient()

def chat_with_context(user_id: str, message: str):
    augmented = ral.augment(user_id=user_id, prompt=message, provider="openai")
    
    return client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": augmented.system_context},
            {"role": "user", "content": augmented.user_message}
        ]
    )
```

#### 4. Local LLMs (Ollama, LM Studio, etc.)
**Method:** Same pattern, generic provider format

```python
augmented = ral.augment(user_id="local", prompt=message, provider="generic")

# Works with any OpenAI-compatible API
response = requests.post("http://localhost:11434/v1/chat/completions", json={
    "model": "llama2",
    "messages": [
        {"role": "system", "content": augmented.system_context},
        {"role": "user", "content": augmented.user_message}
    ]
})
```

#### 5. IDEs (VS Code, Cursor, etc.)
**Method:** Extension that intercepts AI assistant calls

```typescript
// VS Code extension intercepts Copilot/AI requests
vscode.workspace.onWillSendAIRequest(async (request) => {
    const augmented = await ral.augment({
        userId: vscode.env.machineId,
        prompt: request.prompt,
        provider: 'generic'
    });
    request.systemPrompt = augmented.systemContext;
});
```

### Privacy Preservation

| Scenario | RAL Behavior |
|----------|--------------|
| Public AI (ChatGPT) | Only inject non-sensitive context |
| Private AI (local) | Full context available |
| Enterprise AI | Follow tenant privacy rules |
| Unknown provider | Minimal context, user confirmation |

### Graceful Degradation

| Failure Mode | Behavior |
|--------------|----------|
| RAL unavailable | Pass through original message |
| Timeout (>100ms) | Pass through + log warning |
| Invalid context | Skip that context type |
| Auth failure | Pass through + surface error |

**Rule:** RAL failure must NEVER block the user's AI interaction.

---

## 6. Thin Client Designs

### Principle: Clients Are Dumb Pipes

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT RESPONSIBILITIES                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ ALLOWED:                                                    │
│  • Collect signals (timestamp, timezone, locale)                │
│  • Send to RAL API                                              │
│  • Receive augmented prompt                                     │
│  • Inject into target AI                                        │
│  • Cache API responses (short TTL)                              │
│                                                                 │
│  ❌ FORBIDDEN:                                                  │
│  • Context resolution logic                                     │
│  • Temporal calculations                                        │
│  • Drift detection                                              │
│  • Privacy decisions                                            │
│  • Any "smart" behavior                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Browser Extension (Primary Growth Vector)

**Repo:** `ral-extension`

**Responsibilities:**
1. Detect AI chat interfaces (ChatGPT, Claude, Gemini, etc.)
2. Collect browser signals (timezone, locale, URL context)
3. Intercept user messages before send
4. Call RAL API for augmentation
5. Inject augmented content
6. Show minimal status indicator

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER EXTENSION                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  manifest.json                                              │
│  ├── permissions: activeTab, storage                        │
│  ├── content_scripts: [chatgpt.com, claude.ai, ...]        │
│  └── background: service_worker.js                          │
│                                                             │
│  content_scripts/                                           │
│  ├── chatgpt.js     # ChatGPT-specific DOM handling        │
│  ├── claude.js      # Claude-specific DOM handling         │
│  ├── gemini.js      # Gemini-specific DOM handling         │
│  └── generic.js     # Fallback for unknown sites           │
│                                                             │
│  background/                                                │
│  ├── service_worker.js  # API calls to RAL                 │
│  └── storage.js         # User preferences                 │
│                                                             │
│  popup/                                                     │
│  ├── popup.html     # Status + settings                    │
│  └── popup.js       # Toggle, config                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Update Strategy:**
- Auto-update via browser store
- Settings sync via RAL API
- No client-side business logic to update

---

### Python SDK

**Package:** `ral-client` on PyPI

**Responsibilities:**
1. Typed API client
2. Retry/timeout handling
3. Response parsing
4. Async support

**API:**
```python
from ral import RALClient, RALConfig

# Initialize
client = RALClient(
    base_url="http://localhost:8765",  # or https://api.ral.dev
    api_key="optional_for_local",
    timeout=5.0
)

# Core methods
response = await client.resolve(user_id, message, signals)
response = await client.augment(user_id, prompt, provider, options)
response = await client.get_snapshot(user_id)
response = await client.get_drift_status(user_id)
response = await client.update_context(user_id, updates)

# Convenience
@client.with_context(user_id="default")
def my_llm_call(prompt: str):
    # prompt is automatically augmented
    pass
```

**What the SDK does NOT do:**
- ❌ Cache context locally (beyond short TTL)
- ❌ Perform any resolution logic
- ❌ Make decisions about context inclusion

---

### JavaScript/TypeScript SDK

**Package:** `@ral/client` on npm

**Responsibilities:** Same as Python SDK

**API:**
```typescript
import { RALClient, type RALConfig } from '@ral/client';

const client = new RALClient({
  baseUrl: 'http://localhost:8765',
  apiKey: 'optional',
  timeout: 5000,
});

// Core methods
const resolved = await client.resolve({ userId, message, signals });
const augmented = await client.augment({ userId, prompt, provider, options });
const snapshot = await client.getSnapshot(userId);
const drift = await client.getDriftStatus(userId);

// React hook (separate package: @ral/react)
function ChatInput() {
  const { augment, loading } = useRAL();
  
  const handleSend = async (message: string) => {
    const { systemContext, userMessage } = await augment(message);
    // send to AI
  };
}
```

---

## 7. Control Dashboard Scope

### What the Dashboard IS

A **read-mostly control panel** for:
- Viewing current context state
- Managing API keys
- Reviewing drift warnings
- Setting preferences
- Debugging integrations

### What the Dashboard is NOT

- ❌ A chatbot interface
- ❌ An AI assistant
- ❌ A place to interact with LLMs
- ❌ A replacement for ChatGPT/Claude

### Dashboard Pages

```
/dashboard
├── /overview          # Health status, recent activity
├── /context           # Current context snapshot, history
├── /drift             # Drift warnings, recommendations
├── /settings          # Preferences, timezone, locale
├── /api-keys          # Manage API keys
├── /integrations      # Connected apps, extension status
└── /debug             # Request logs, troubleshooting
```

### Dashboard Rules

| Rule | Rationale |
|------|-----------|
| No chat interface | RAL is not a chatbot |
| Read-heavy, write-light | Users inspect more than configure |
| No AI features | Dashboard doesn't need AI |
| Fast and simple | Not a power-user tool |
| Mobile-friendly | Context inspection on any device |

---

## 8. Open-Source Strategy

### Repository Structure

```
github.com/raldev/
├── ral-core           # 🔓 Open Source (Apache 2.0)
│   ├── app/engines/   # Context engines
│   ├── app/api/       # API endpoints  
│   ├── app/models/    # Data models
│   └── tests/         # Full test suite
│
├── ral-client-python  # 🔓 Open Source (MIT)
│   └── SDK for Python
│
├── ral-client-js      # 🔓 Open Source (MIT)
│   └── SDK for JavaScript/TypeScript
│
├── ral-extension      # 🔓 Open Source (MIT)
│   └── Browser extension
│
├── ral-dashboard      # 🔓 Open Source (MIT)
│   └── Control dashboard
│
├── ral-deploy         # 🔓 Open Source (MIT)
│   └── Deployment templates
│
└── ral-cloud          # 🔒 Closed Source
    └── Multi-tenant SaaS infrastructure
```

### What's Open vs. Closed

| Component | License | Rationale |
|-----------|---------|-----------|
| Core engines | Apache 2.0 | Trust requires transparency |
| API server | Apache 2.0 | Self-hosting is primary model |
| SDKs | MIT | Maximum adoption |
| Extension | MIT | Trust + contribution |
| Dashboard | MIT | Customization |
| Cloud infra | Proprietary | Monetization |
| Enterprise features | Proprietary | Revenue |

### Why Apache 2.0 for Core

1. **Trust** - Users can audit context handling
2. **Contribution** - Community can improve engines
3. **Fork protection** - Patent grant, attribution required
4. **Enterprise-friendly** - Allowed in commercial products

### Contribution Boundaries

| Area | External Contributions |
|------|------------------------|
| Bug fixes | ✅ Welcome |
| New integrations | ✅ Welcome |
| Engine improvements | ⚠️ Careful review |
| Core guarantees | ❌ Not accepted |
| API changes | ❌ RFC required |

---

## 9. Versioning & Future-Proofing

### Version Scheme

```
v{major}.{minor}.{patch}

v0.1.0  ← Current (pre-release)
v0.2.0  ← New features, may break
v1.0.0  ← Stable API, backward compatible
v1.1.0  ← New features, backward compatible
v2.0.0  ← Breaking changes
```

### API Versioning

```
/api/v0/*  ← Current, may change
/api/v1/*  ← Stable (when released)
```

**Rules:**
- v0 can break at any time (pre-release)
- v1+ follows semantic versioning
- Old versions supported for 12 months after deprecation
- Deprecation warnings in responses 6 months before removal

### Backward Compatibility Rules

| Change Type | Allowed in Minor? |
|-------------|-------------------|
| New endpoint | ✅ Yes |
| New optional field | ✅ Yes |
| New required field | ❌ No (major only) |
| Remove field | ❌ No (major only) |
| Change field type | ❌ No (major only) |
| Change behavior | ❌ No (major only) |

### Adding New LLMs

**Design principle:** RAL is LLM-agnostic by design.

Adding a new LLM requires:
1. Define provider format in `PromptComposer`
2. Add to `provider` enum in API
3. No other changes needed

```python
# Adding a new LLM provider
class PromptComposer:
    PROVIDER_FORMATS = {
        "openai": OpenAIFormat,
        "anthropic": AnthropicFormat,
        "google": GoogleFormat,
        "generic": GenericFormat,
        # Adding new provider:
        "new_provider": NewProviderFormat,  # ← Just add format
    }
```

### Client Upgrade Strategy

| Client | Update Mechanism |
|--------|-----------------|
| Browser Extension | Auto-update via store |
| Python SDK | `pip install --upgrade ral-client` |
| JS SDK | `npm update @ral/client` |
| Docker | `docker pull raldev/ral:latest` |

**Rule:** Clients should work with newer server versions (forward compatible).

---

## 10. 30-Day Execution Plan

### Week 1: Package Core for Distribution

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Create `Dockerfile.prod` with SQLite single-user mode | Production Docker image |
| 3 | Set up Docker Hub automated builds | `raldev/ral:0.1` published |
| 4-5 | Create `pip install ral` package with CLI | PyPI package |
| 5 | Write one-command install scripts | `install.sh`, docs |

**Exit criteria:** `docker run raldev/ral:0.1` works on any machine.

---

### Week 2: Build Python & JS SDKs

| Day | Task | Deliverable |
|-----|------|-------------|
| 6-7 | Python SDK with typed client | `ral-client` on PyPI |
| 8-9 | JavaScript SDK with TypeScript | `@ral/client` on npm |
| 10 | SDK documentation + examples | SDK docs site |

**Exit criteria:** 5-line integration with any LLM.

---

### Week 3: Browser Extension MVP

| Day | Task | Deliverable |
|-----|------|-------------|
| 11-12 | Extension scaffold + ChatGPT support | Working extension |
| 13 | Claude support | Multi-AI support |
| 14-15 | Settings popup + RAL connection | User-configurable |

**Exit criteria:** Extension augments ChatGPT messages.

---

### Week 4: Polish & Documentation

| Day | Task | Deliverable |
|-----|------|-------------|
| 16-17 | Integration guides (5 platforms) | Docs for each AI |
| 18-19 | Dashboard cleanup + deployment | Usable dashboard |
| 20-21 | End-to-end testing + bug fixes | Stable v0.1.0 |

**Exit criteria:** Complete getting-started experience.

---

### Success Metrics (30 Days)

| Metric | Target |
|--------|--------|
| Time to first value | < 60 seconds |
| Integration code lines | < 10 lines |
| Platforms supported | ChatGPT, Claude, Gemini, local LLMs |
| Documentation coverage | 100% of API |
| Docker pull success rate | > 99% |

---

## Appendix A: File Structure After Packaging

```
github.com/raldev/ral/
├── README.md                    # Updated for v0.1
├── LICENSE                      # Apache 2.0
├── docker-compose.yml           # Development
├── docker-compose.prod.yml      # Production
├── Dockerfile                   # Multi-stage build
│
├── services/
│   └── ral-core/
│       ├── pyproject.toml       # Version 0.1.0
│       ├── ral/                  # Renamed from app/ for packaging
│       │   ├── __init__.py
│       │   ├── main.py
│       │   ├── cli.py           # NEW: CLI entry point
│       │   ├── engines/
│       │   ├── api/
│       │   └── ...
│       └── tests/
│
├── sdks/
│   ├── python/                  # ral-client
│   │   ├── pyproject.toml
│   │   ├── ral_client/
│   │   └── tests/
│   │
│   └── javascript/              # @ral/client
│       ├── package.json
│       ├── src/
│       └── tests/
│
├── extension/                   # Browser extension
│   ├── manifest.json
│   ├── content_scripts/
│   └── background/
│
├── dashboard/                   # Existing dashboard
│
└── docs/
    ├── getting-started.md
    ├── api-reference.md
    ├── integration-guides/
    │   ├── chatgpt.md
    │   ├── claude.md
    │   ├── gemini.md
    │   └── local-llms.md
    └── deployment/
        ├── docker.md
        ├── kubernetes.md
        └── cloud.md
```

---

## Appendix B: API Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                     RAL API v0.1 Quick Reference                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Base: http://localhost:8765/api/v0                             │
│                                                                 │
│  POST /context/resolve                                          │
│       → Resolve "today", "now", "here" to concrete values       │
│                                                                 │
│  POST /prompt/augment                                           │
│       → Get context-augmented prompt for any LLM                │
│                                                                 │
│  GET  /context/snapshot?user_id=...                             │
│       → Current context state                                   │
│                                                                 │
│  GET  /drift/status?user_id=...                                 │
│       → Context staleness warnings                              │
│                                                                 │
│  POST /context/update                                           │
│       → Explicitly update context                               │
│                                                                 │
│  GET  /health                                                   │
│       → Service health check                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

**Document Version:** 0.1.0  
**Last Updated:** January 4, 2026  
**Status:** Ready for Implementation
