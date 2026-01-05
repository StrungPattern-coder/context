# RAL v0.1 Quick Reference

## 📦 Distribution Channels

```bash
# Docker (Primary)
docker run -d -p 8765:8765 raldev/ral:0.1

# Python Package
pip install ral-core
ral start

# Python SDK
pip install ral-client

# JavaScript SDK  
npm install @ral/client

# Browser Extension
# Chrome Web Store → "RAL Context Layer"
```

---

## 🔌 API Endpoints (v0 Contract)

**Base URL:** `http://localhost:8765/api/v0`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/context/resolve` | Resolve "today", "now", "here" |
| POST | `/prompt/augment` | Augment prompt for any LLM |
| GET | `/context/snapshot` | Get context state |
| GET | `/drift/status` | Check staleness |
| POST | `/context/update` | Manually set context |

---

## 🐍 Python SDK

```python
from ral_client import RALClient

client = RALClient(base_url="http://localhost:8765")

# Augment prompt
result = client.augment(
    user_id="user_123",
    prompt="What's the weather today?",
    provider="openai",
    signals={"timezone": "America/New_York"}
)

# Use with OpenAI
import openai
response = openai.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": result.system_context},
        {"role": "user", "content": result.user_message}
    ]
)
```

---

## 📘 JavaScript SDK

```typescript
import { RALClient } from '@ral/client';

const client = new RALClient({ baseUrl: 'http://localhost:8765' });

const result = await client.augment({
  userId: 'user_123',
  prompt: 'Schedule a meeting tomorrow',
  provider: 'anthropic',
  signals: { timezone: 'America/New_York' }
});

// Use with Anthropic
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic();

const message = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  system: result.systemContext,
  messages: [{ role: 'user', content: result.userMessage }]
});
```

---

## 🧩 Browser Extension

**What it does:**
- Detects ChatGPT/Claude/Gemini
- Intercepts user messages
- Calls RAL API for context
- Injects augmented prompt
- Shows "Powered by RAL" badge

**Settings:**
- RAL server URL
- User ID
- Enable per site

---

## 📋 30-Day Milestones

| Day | Milestone |
|-----|-----------|
| **3** | Docker image on Docker Hub |
| **5** | Python package on PyPI |
| **7** | Python SDK published |
| **9** | JavaScript SDK published |
| **12** | Extension works with ChatGPT |
| **15** | Extension works with 3 AIs |
| **21** | All integration guides complete |

---

## 🎯 Success Criteria

- [ ] `docker run raldev/ral:0.1` works in <5 seconds
- [ ] Integration code is <10 lines
- [ ] Works with ChatGPT, Claude, Gemini, OpenAI API, local LLMs
- [ ] Time to first value <60 seconds
- [ ] All 5 API endpoints documented
- [ ] 100% test pass rate maintained

---

## 🚫 Hard Constraints

**DO NOT:**
- Build a chatbot UI
- Add new core features
- Weaken privacy guarantees
- Lock users to one AI provider
- Over-optimize infrastructure prematurely

**DO:**
- Package existing features
- Write integration guides
- Build thin clients
- Make installation frictionless
- Maintain all guarantees

---

## 📚 Documentation Map

```
docs/
├── PRODUCT_DISTRIBUTION.md    # 21-page product strategy ✓
├── 30_DAY_PLAN.md             # Week-by-week execution ✓
├── V0.1_SUMMARY.md            # Technical summary ✓
├── EXECUTIVE_SUMMARY.md       # Exec overview ✓
├── ARCHITECTURE.md            # Core architecture ✓
├── PHILOSOPHY.md              # Design principles ✓
├── VALIDATION_PLAN.md         # Test criteria ✓
└── integrations/ (TO CREATE)
    ├── chatgpt.md
    ├── claude.md
    ├── gemini.md
    ├── openai-api.md
    └── local-llms.md
```

---

## 🔧 CLI Commands

```bash
# Start server
ral start [--host 0.0.0.0] [--port 8765] [--reload]

# Show version
ral version

# Check health
ral health [--url http://localhost:8765]

# Show config
ral config --show
```

---

## 🎨 Design Principles

1. **Invisible** - Users forget RAL exists
2. **Universal** - Works with any AI
3. **Minimal** - Only inject what's needed
4. **Trustworthy** - Never hallucinate
5. **Private** - User owns their data

---

## 📊 Current Progress

```
Core:         100% ████████████████████ COMPLETE
Tests:        100% ████████████████████ COMPLETE  
Docs:          80% ████████████████░░░░ IN PROGRESS
Packaging:     20% ████░░░░░░░░░░░░░░░░ SCAFFOLDING DONE
Distribution:   0% ░░░░░░░░░░░░░░░░░░░░ NOT STARTED
```

**Overall v0.1:** 63% complete

---

## 🚀 What's Next?

**Immediate:** Create `Dockerfile.prod`  
**Week 1:** Publish Docker image  
**Week 2:** Publish SDKs  
**Week 3:** Build extension  
**Week 4:** Complete docs + testing

**First user:** Should be able to use RAL in <60 seconds  
**First success:** "It just worked, I didn't have to think about it"

---

**Version:** 0.1.0  
**License:** Apache 2.0 (core), MIT (clients)  
**Status:** Ready for implementation 🚀
