# Reality Anchoring Layer (RAL) - System Architecture

## Architecture Overview

RAL is designed as a cloud-native, microservices-based platform with clear boundaries between components. The architecture follows domain-driven design principles with event-driven communication.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT APPLICATIONS                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Web App    │  │  Mobile App  │  │   CLI Tool   │  │  3rd Party   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┘
          │                 │                 │                 │
          └─────────────────┴────────┬────────┴─────────────────┘
                                     │
                            ┌────────▼────────┐
                            │   API Gateway   │
                            │  (Kong/Nginx)   │
                            └────────┬────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
┌───────▼───────┐          ┌────────▼────────┐          ┌────────▼────────┐
│  Auth Service │          │   RAL Core API  │          │ Dashboard API   │
│   (JWT/OAuth) │          │    (FastAPI)    │          │   (FastAPI)     │
└───────┬───────┘          └────────┬────────┘          └────────┬────────┘
        │                           │                            │
        └───────────────────────────┼────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
           ┌────────▼────────┐     │      ┌────────▼────────┐
           │ Context Ingress │     │      │  Query Service  │
           │    Service      │     │      │                 │
           └────────┬────────┘     │      └────────┬────────┘
                    │              │               │
                    │      ┌───────▼───────┐       │
                    │      │   Event Bus   │       │
                    │      │ (Redis/Kafka) │       │
                    │      └───────┬───────┘       │
                    │              │               │
    ┌───────────────┼──────────────┼───────────────┼───────────────┐
    │               │              │               │               │
┌───▼────┐   ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐ ┌──────▼──────┐
│Temporal│   │   Spatial   │ │Situational│ │ Assumption  │ │   Drift     │
│Context │   │   Context   │ │  Context  │ │  Resolver   │ │  Detector   │
│ Engine │   │   Engine    │ │  Engine   │ │   Engine    │ │   Engine    │
└───┬────┘   └──────┬──────┘ └─────┬─────┘ └──────┬──────┘ └──────┬──────┘
    │               │              │               │               │
    └───────────────┴──────────────┴───────────────┴───────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
             ┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼─────┐
             │   Context   │ │   Prompt  │ │    LLM    │
             │   Memory    │ │Composition│ │  Adapter  │
             │   Service   │ │  Engine   │ │   Layer   │
             └──────┬──────┘ └─────┬─────┘ └─────┬─────┘
                    │              │              │
                    │              │              │
    ┌───────────────┼──────────────┘              │
    │               │                             │
┌───▼────┐   ┌──────▼──────┐               ┌──────▼──────┐
│PostgreSQL│ │    Redis    │               │ LLM Providers│
│(Primary) │ │   (Cache)   │               │ OpenAI/Claude│
└──────────┘ └─────────────┘               └──────────────┘
```

---

## Component Breakdown

### Layer 1: Client Layer

| Component | Purpose |
|-----------|---------|
| Web App | Browser-based applications integrating RAL |
| Mobile App | iOS/Android applications |
| CLI Tool | Developer tools and scripts |
| 3rd Party | External integrations via API |

**Protocol**: HTTPS with JWT authentication

---

### Layer 2: Gateway Layer

#### API Gateway
- **Technology**: Kong or Nginx
- **Responsibilities**:
  - Rate limiting
  - Request routing
  - SSL termination
  - API versioning
  - Request/response logging

#### Authentication Service
- **Technology**: Custom service with JWT + OAuth2
- **Responsibilities**:
  - User authentication
  - Tenant management
  - API key generation
  - Permission validation

---

### Layer 3: API Layer

#### RAL Core API
- **Technology**: FastAPI (Python)
- **Endpoints**:
  - `POST /v1/context/anchor` - Anchor context for a request
  - `POST /v1/context/update` - Update user context
  - `GET /v1/context/{user_id}` - Retrieve current context
  - `POST /v1/prompt/compose` - Generate anchored prompt

#### Dashboard API
- **Technology**: FastAPI (Python)
- **Endpoints**:
  - `GET /v1/dashboard/context` - View all context
  - `PUT /v1/dashboard/context/{id}` - Edit context
  - `DELETE /v1/dashboard/context/{id}` - Remove context
  - `GET /v1/dashboard/history` - View context history

---

### Layer 4: Core Processing Layer

#### Context Ingress Service
- **Responsibility**: Validate and normalize incoming context signals
- **Input**: Raw timestamps, location strings, user messages
- **Output**: Normalized context events

#### Query Service
- **Responsibility**: Handle read requests for context
- **Pattern**: CQRS (Command Query Responsibility Segregation)

---

### Layer 5: Context Engines

#### Temporal Context Engine
- **Responsibility**: Time-based context interpretation
- **Capabilities**:
  - Timezone-aware datetime handling
  - Time-of-day semantics (morning, afternoon, evening, night)
  - Day-of-week semantics (weekday, weekend)
  - Relative time resolution ("today", "yesterday", "now")
  - Midnight crossover handling
  - Session-relative time tracking

#### Spatial Context Engine
- **Responsibility**: Location and locale interpretation
- **Capabilities**:
  - Country/region normalization
  - Locale inference (language, currency, units)
  - Cultural defaults
  - Explicit consent management

#### Situational Context Engine
- **Responsibility**: Ongoing task and conversation tracking
- **Capabilities**:
  - Active task tracking
  - Reference resolution across messages
  - Implicit assumption building
  - Conversation threading

#### Assumption Resolver Engine
- **Responsibility**: Resolve ambiguous references
- **Capabilities**:
  - Natural language reference resolution
  - Confidence scoring (0.0–1.0)
  - Clarification request generation
  - Multi-signal fusion

#### Drift Detector Engine
- **Responsibility**: Identify context staleness and conflicts
- **Capabilities**:
  - Staleness detection
  - Conflict identification
  - Correction pattern recognition
  - Alert generation

---

### Layer 6: Memory & Composition

#### Context Memory Service
- **Responsibility**: Persistent, versioned context storage
- **Storage Tiers**:
  - **Long-term**: User defaults (PostgreSQL)
  - **Short-term**: Active sessions (Redis + PostgreSQL)
  - **Ephemeral**: Temporary assumptions (Redis)
- **Features**:
  - Version history
  - Time-based decay
  - Rollback capability
  - User edit tracking

#### Prompt Composition Engine
- **Responsibility**: Assemble context for injection
- **Capabilities**:
  - Relevance scoring
  - Minimal inclusion logic
  - Token budget management
  - Provider-agnostic output

#### LLM Adapter Layer
- **Responsibility**: Format prompts for specific providers
- **Supported Providers**:
  - OpenAI (GPT-4, GPT-4o)
  - Anthropic (Claude)
  - Google (Gemini)
  - Open-source (Llama, Mistral)
- **Adapter Pattern**: Each provider has a dedicated adapter implementing a common interface

---

### Layer 7: Data Layer

#### PostgreSQL (Primary Database)
- **Purpose**: Persistent storage
- **Stores**:
  - User profiles
  - Tenant configurations
  - Long-term context
  - Context history
  - Audit logs

#### Redis (Cache & Ephemeral)
- **Purpose**: Fast access and temporary storage
- **Stores**:
  - Session context
  - Ephemeral assumptions
  - Rate limiting counters
  - Event queue

---

## Data Flow Examples

### Flow 1: Context Anchoring Request

```
1. Client sends request with user context signals
2. API Gateway routes to RAL Core API
3. Auth Service validates JWT token
4. Context Ingress normalizes signals
5. Event published to Event Bus
6. Context Engines process in parallel:
   - Temporal Engine interprets time
   - Spatial Engine interprets location
   - Assumption Resolver scores confidence
7. Context Memory persists results
8. Response returned with anchored context ID
```

### Flow 2: Prompt Composition

```
1. Client requests composed prompt with context
2. Query Service retrieves current context from Memory
3. Prompt Composition Engine:
   a. Scores relevance of each context element
   b. Applies minimal inclusion logic
   c. Formats as provider-agnostic structure
4. LLM Adapter transforms for target provider
5. Composed prompt returned to client
```

### Flow 3: Context Drift Detection

```
1. User corrects AI response (implicit signal)
2. Correction logged as context event
3. Drift Detector analyzes correction patterns
4. If threshold exceeded:
   a. Flag context as potentially stale
   b. Reduce confidence score
   c. Optionally notify user
5. Updated context persisted
```

---

## Security Architecture

### Authentication
- JWT tokens for API access
- OAuth2 for user authentication
- API keys for server-to-server communication

### Authorization
- Role-based access control (RBAC)
- Tenant isolation at database level
- User-specific context isolation

### Data Protection
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- PII handling with explicit consent
- Data retention policies

### Audit
- All context access logged
- Change history preserved
- Compliance-ready audit trails

---

## Scalability Strategy

### Horizontal Scaling
- Stateless API services scale behind load balancer
- Context Engines scale independently
- Event Bus enables async processing

### Data Partitioning
- User-based sharding for context data
- Tenant-based isolation

### Caching Strategy
- Redis for hot context data
- Read replicas for PostgreSQL
- CDN for Dashboard static assets

---

## Observability

### Metrics
- Request latency (p50, p95, p99)
- Context resolution accuracy
- Confidence score distribution
- Cache hit rates

### Logging
- Structured JSON logging
- Request correlation IDs
- Context decision audit trails

### Tracing
- Distributed tracing (OpenTelemetry)
- End-to-end request visibility
- Performance bottleneck identification

---

## Technology Choices Rationale

| Choice | Rationale |
|--------|-----------|
| **FastAPI (Python)** | High performance, async support, automatic OpenAPI docs, type safety with Pydantic |
| **PostgreSQL** | ACID compliance, JSON support, excellent for versioned data, proven at scale |
| **Redis** | Sub-millisecond latency, pub/sub for events, TTL for ephemeral data |
| **TypeScript (Dashboard)** | Type safety, modern tooling, React ecosystem |
| **Kong/Nginx** | Production-proven, plugin ecosystem, observability |
| **Docker/Kubernetes** | Cloud-native deployment, horizontal scaling |

---

## Future Extensions

1. **GraphQL API**: Alternative query interface
2. **WebSocket Support**: Real-time context updates
3. **ML-based Confidence**: Learn confidence from user corrections
4. **Multi-modal Context**: Image, voice, document context
5. **Edge Deployment**: Client-side context for privacy
