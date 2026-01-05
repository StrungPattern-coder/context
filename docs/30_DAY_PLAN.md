# RAL v0.1 - 30-Day Execution Plan

**Version:** 0.1.0  
**Status:** Ready to Execute  
**Goal:** Transform RAL from tested core → one-click universal product

---

## ✅ What's Already Complete

- [x] Core engines (7 engines, all tested)
- [x] API server (FastAPI, async)
- [x] Database layer (SQLAlchemy, PostgreSQL/SQLite)
- [x] Multi-tenant isolation
- [x] Test suite (117 passing tests)
- [x] Documentation (Architecture, Philosophy, Validation Plan)
- [x] Product distribution strategy (PRODUCT_DISTRIBUTION.md)

---

## 🎯 30-Day Goals

By end of Day 30:

1. **Anyone can run RAL in <60 seconds** with `docker run raldev/ral:0.1`
2. **SDK integrations work** with ChatGPT, Claude, Gemini, local LLMs
3. **Browser extension** augments ChatGPT/Claude automatically
4. **Documentation** covers all integration paths
5. **v0.1.0** tagged and released

---

## Week 1: Docker Packaging & Core Distribution

### Day 1-2: Production Docker Image

**Tasks:**
- [ ] Create `Dockerfile.prod` with SQLite single-user mode
- [ ] Multi-stage build (build → runtime)
- [ ] Health check endpoint verification
- [ ] Environment variable configuration
- [ ] Default single-user mode (no auth required)

**Deliverables:**
```dockerfile
# Dockerfile.prod
FROM python:3.11-slim as builder
WORKDIR /app
COPY services/ral-core/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY services/ral-core/app /app
ENV DATABASE_URL=sqlite:///./ral.db
ENV ENABLE_AUTH=false
EXPOSE 8765
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8765"]
```

**Exit Criteria:**
- `docker build -f Dockerfile.prod -t raldev/ral:0.1 .` succeeds
- `docker run -p 8765:8765 raldev/ral:0.1` starts in <5 seconds
- `curl http://localhost:8765/health` returns `{"status": "healthy"}`

---

### Day 3: Docker Hub & Automated Builds

**Tasks:**
- [ ] Create Docker Hub account/organization: `raldev`
- [ ] Set up GitHub Actions for automated builds
- [ ] Tag and push `raldev/ral:0.1` and `raldev/ral:latest`
- [ ] Test pull and run on clean machine

**Deliverables:**
```yaml
# .github/workflows/docker-publish.yml
name: Publish Docker Image

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: docker/build-push-action@v4
        with:
          context: .
          file: Dockerfile.prod
          push: true
          tags: raldev/ral:${{ github.ref_name }},raldev/ral:latest
```

**Exit Criteria:**
- Anyone can run: `docker run -d -p 8765:8765 raldev/ral:0.1`
- Image size < 500MB
- Start time < 5 seconds

---

### Day 4-5: Python Package Distribution

**Tasks:**
- [ ] Update `pyproject.toml` with CLI entry point (`ral` command)
- [ ] Create PyPI account and token
- [ ] Build and test package locally
- [ ] Publish to PyPI as `ral-core` (0.1.0)
- [ ] Test install on clean environment

**Commands to work:**
```bash
pip install ral-core
ral start
# → Server starts on http://localhost:8765

ral version
# → Reality Anchoring Layer (RAL) v0.1.0

ral health --url http://localhost:8765
# → ✓ RAL server is healthy
```

**Deliverables:**
- Package on PyPI: https://pypi.org/project/ral-core/
- CLI works: `ral start`, `ral version`, `ral health`, `ral config`

**Exit Criteria:**
- `pip install ral-core && ral start` works on Mac, Linux, Windows
- Package includes all dependencies
- CLI help text is clear

---

## Week 2: Python & JavaScript SDKs

### Day 6-7: Python SDK

**Tasks:**
- [ ] Publish `ral-client` to PyPI (separate from ral-core)
- [ ] Complete client.py implementation (already scaffolded)
- [ ] Add retry logic with exponential backoff
- [ ] Write SDK tests (pytest)
- [ ] Generate API documentation

**Example:**
```python
from ral_client import RALClient

client = RALClient(base_url="http://localhost:8765")
result = client.augment(
    user_id="user_123",
    prompt="What's the weather today?",
    provider="openai"
)

# Use with OpenAI
import openai
openai.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": result.system_context},
        {"role": "user", "content": result.user_message}
    ]
)
```

**Exit Criteria:**
- 5-line integration with OpenAI
- 5-line integration with Anthropic
- Error handling tested
- Package on PyPI

---

### Day 8-9: JavaScript/TypeScript SDK

**Tasks:**
- [ ] Implement TypeScript client in `sdks/javascript/src/`
- [ ] Generate type definitions
- [ ] Build with `tsup` (CJS + ESM)
- [ ] Write tests with Vitest
- [ ] Publish to npm as `@ral/client`

**Example:**
```typescript
import { RALClient } from '@ral/client';

const client = new RALClient({ baseUrl: 'http://localhost:8765' });

const result = await client.augment({
  userId: 'user_123',
  prompt: 'Schedule a meeting tomorrow',
  provider: 'anthropic',
});

// Use with Anthropic SDK
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic();

const message = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  system: result.systemContext,
  messages: [{ role: 'user', content: result.userMessage }],
});
```

**Exit Criteria:**
- Works in Node.js and browsers
- TypeScript types are complete
- Published to npm
- Bundle size < 50KB

---

### Day 10: SDK Documentation

**Tasks:**
- [ ] Create `docs/sdk-python.md`
- [ ] Create `docs/sdk-javascript.md`
- [ ] Add code examples for all methods
- [ ] Document error handling
- [ ] Add integration examples (OpenAI, Anthropic, Google, local LLMs)

**Exit Criteria:**
- Every SDK method has example
- Common patterns documented
- Troubleshooting guide included

---

## Week 3: Browser Extension MVP

### Day 11-12: Extension Scaffold + ChatGPT

**Tasks:**
- [ ] Create `extension/` directory structure
- [ ] Write `manifest.json` (Chrome + Firefox compatible)
- [ ] Implement content script for ChatGPT
- [ ] Detect message send, intercept, augment, inject
- [ ] Add minimal UI indicator (RAL active/inactive)

**Structure:**
```
extension/
├── manifest.json
├── background/
│   └── service-worker.js    # RAL API calls
├── content-scripts/
│   ├── chatgpt.js           # ChatGPT-specific DOM
│   ├── claude.js            # Claude-specific DOM
│   └── gemini.js            # Gemini-specific DOM
├── popup/
│   ├── popup.html           # Settings popup
│   └── popup.js
└── icons/
    └── icon.png
```

**Exit Criteria:**
- Extension loads in Chrome
- ChatGPT messages are augmented with context
- User sees "Powered by RAL" indicator

---

### Day 13: Claude Support

**Tasks:**
- [ ] Implement `claude.js` content script
- [ ] Handle Claude-specific DOM structure
- [ ] Format context for Claude's XML style
- [ ] Test on claude.ai

**Exit Criteria:**
- Claude messages augmented correctly
- Context injected as `<context>...</context>`

---

### Day 14-15: Settings & Multi-AI Support

**Tasks:**
- [ ] Build settings popup UI
- [ ] Allow user to configure RAL server URL
- [ ] Add enable/disable toggle per site
- [ ] Add Gemini support
- [ ] Store preferences in `chrome.storage.sync`

**Settings UI:**
```
┌─────────────────────────────────────┐
│  Reality Anchoring Layer (RAL)      │
├─────────────────────────────────────┤
│  RAL Server: http://localhost:8765  │
│  User ID: user_123                  │
│                                     │
│  Enable for:                        │
│  ☑ ChatGPT                          │
│  ☑ Claude                           │
│  ☑ Gemini                           │
│                                     │
│  [Save Settings]                    │
└─────────────────────────────────────┘
```

**Exit Criteria:**
- Extension works with 3 AI platforms
- Settings persist across sessions
- Graceful fallback if RAL unavailable

---

## Week 4: Documentation & Polish

### Day 16-17: Integration Guides

**Tasks:**
- [ ] Write `docs/integrations/chatgpt.md`
- [ ] Write `docs/integrations/claude.md`
- [ ] Write `docs/integrations/gemini.md`
- [ ] Write `docs/integrations/openai-api.md`
- [ ] Write `docs/integrations/local-llms.md`

Each guide must include:
- Prerequisites
- Step-by-step setup
- Code example
- Troubleshooting

**Exit Criteria:**
- 5 complete integration guides
- Each guide tested by someone who didn't write it

---

### Day 18-19: Dashboard Polish

**Tasks:**
- [ ] Update dashboard to use v0 API
- [ ] Clean up UI (remove unused features)
- [ ] Add context inspection view
- [ ] Add drift warnings view
- [ ] Deploy dashboard with Docker

**Dashboard Pages (Minimal):**
- `/` - Health status
- `/context/:userId` - Context snapshot viewer
- `/drift/:userId` - Drift warnings
- `/settings` - User preferences

**Exit Criteria:**
- Dashboard deployed and accessible
- All pages work with v0 API
- Mobile-responsive

---

### Day 20-21: End-to-End Testing & Bug Fixes

**Tasks:**
- [ ] Test full flow: Install → Use → Benefit
- [ ] Test Docker install on Mac, Linux, Windows
- [ ] Test Python SDK with OpenAI, Anthropic
- [ ] Test JavaScript SDK in Node and browser
- [ ] Test extension on all 3 platforms
- [ ] Fix all critical bugs

**Test Matrix:**
```
OS x Install Method x AI Platform

OSes: macOS, Linux, Windows
Install: Docker, pip, npm, extension
AIs: ChatGPT, Claude, Gemini, OpenAI API, local LLM
```

**Exit Criteria:**
- Zero critical bugs
- All test combinations work
- Installation time < 60 seconds

---

## Final Deliverables (End of Day 30)

### Code & Packages

- [x] Docker image: `raldev/ral:0.1` on Docker Hub
- [ ] Python package: `ral-core` on PyPI
- [ ] Python SDK: `ral-client` on PyPI
- [ ] JS SDK: `@ral/client` on npm
- [ ] Browser extension: Submitted to Chrome Web Store
- [ ] Git tag: `v0.1.0`

### Documentation

- [ ] Updated README.md with v0.1 info
- [ ] docs/PRODUCT_DISTRIBUTION.md (complete ✓)
- [ ] docs/getting-started.md
- [ ] docs/api-reference.md
- [ ] docs/sdk-python.md
- [ ] docs/sdk-javascript.md
- [ ] docs/integrations/ (5 guides)

### Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Time to first value | < 60 seconds | Fresh install → first augmented prompt |
| Integration code lines | < 10 lines | Count lines in examples |
| Platforms supported | 5+ | ChatGPT, Claude, Gemini, OpenAI, local |
| Documentation coverage | 100% API | All endpoints documented |
| Docker pull success | > 99% | Test across machines |
| Test pass rate | 100% | All 117+ tests green |

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Extension rejected by store | Medium | High | Start review process early, prepare Firefox fallback |
| Docker Hub rate limits | Low | Medium | Use GitHub Container Registry as backup |
| SDK API breaking changes | Low | High | Freeze v0 API contract, only additive changes |
| Integration complexity | Medium | High | Extensive docs + examples |
| Timeline slip | Medium | Medium | Focus on MVP, defer polish |

---

## Post-v0.1 Roadmap (Not in 30 Days)

### v0.2 Features (Next 60 Days)
- [ ] Hosted SaaS option (ral.dev)
- [ ] React hooks package (`@ral/react`)
- [ ] VS Code extension
- [ ] Cursor extension
- [ ] LLM adapter implementations (real, not placeholders)

### v1.0 Goals (3-6 Months)
- [ ] Stable API (no breaking changes)
- [ ] 10,000+ Docker pulls
- [ ] 5+ community integrations
- [ ] Production-grade monitoring
- [ ] Enterprise features (SSO, audit logs)

---

## Daily Standup Template

```markdown
### Day X - [Date]

**Completed:**
- [x] Task 1
- [x] Task 2

**In Progress:**
- [ ] Task 3 (50% done)

**Blocked:**
- None

**Tomorrow:**
- [ ] Task 4
- [ ] Task 5

**Metrics:**
- Docker image size: XXX MB
- Test pass rate: 117/117
- Docs coverage: XX%
```

---

**Last Updated:** January 4, 2026  
**Owner:** RAL Team  
**Status:** Ready to Execute
