# RAL Manual Verification Guide

This guide provides step-by-step procedures for manually verifying RAL behavior that cannot be fully automated.

## Table of Contents

1. [Dashboard Verification](#dashboard-verification)
2. [Prompt Artifact Review](#prompt-artifact-review)
3. [API Behavior Verification](#api-behavior-verification)
4. [Security Boundary Testing](#security-boundary-testing)
5. [Performance Sanity Checks](#performance-sanity-checks)

---

## Dashboard Verification

### Purpose
Verify that the monitoring dashboard accurately reflects system state.

### Prerequisites
- RAL Core running locally or in staging
- Access to admin dashboard (usually `http://localhost:8000/admin`)
- Test tenant credentials

### Procedure

#### DV-001: Drift Status Display
1. Create a context via API
2. Record 3 corrections on the context
3. Refresh dashboard
4. **VERIFY**: Context shows `CONFLICTING` status with red indicator
5. **VERIFY**: Correction count shows "3"
6. **VERIFY**: Confidence value is < 0.7

#### DV-002: Staleness Indicator
1. Create a context with `ttl_minutes=1`
2. Wait 2 minutes
3. Refresh dashboard
4. **VERIFY**: Context shows `STALE` badge
5. **VERIFY**: "Last updated" timestamp is accurate

#### DV-003: Tenant Isolation in Dashboard
1. Log in as Tenant A admin
2. Note listed contexts
3. Log out and log in as Tenant B admin
4. **VERIFY**: No Tenant A contexts visible
5. **VERIFY**: Only Tenant B contexts listed

#### DV-004: Health Score Visualization
1. Create multiple contexts with varying health
2. Open health overview panel
3. **VERIFY**: Health scores displayed as percentage
4. **VERIFY**: Low health contexts highlighted
5. **VERIFY**: Aggregated tenant health accurate

---

## Prompt Artifact Review

### Purpose
Review generated prompt artifacts to verify composition decisions.

### Prerequisites
- Test suite has been run with artifact logging enabled
- Access to `tests/artifacts/prompts/` directory

### Procedure

#### PR-001: Privacy Artifact Review
1. Navigate to `tests/artifacts/prompts/`
2. Open artifacts tagged with `SCENARIO_5_PRIVACY_*`
3. Search each artifact for:
   - SSN patterns (`\d{3}-\d{2}-\d{4}`)
   - Credit card patterns (`\d{16}`)
   - API key patterns (`sk-`, `ghp_`, `AKIA`)
4. **VERIFY**: NONE of these patterns appear
5. **SIGN-OFF**: Record reviewer name and date

#### PR-002: Minimality Artifact Review
1. Open artifacts tagged with `SCENARIO_6_PROMPT_MINIMALITY`
2. Compare `token_budget` in metadata to actual prompt length
3. Review `decisions` metadata
4. **VERIFY**: Prompt length respects budget (with 20% margin)
5. **VERIFY**: High relevance items prioritized
6. **VERIFY**: Decisions are explainable

#### PR-003: Staleness Warning Review
1. Open artifacts tagged with `SCENARIO_3_TTL_EXPIRY`
2. For each artifact where `context_included: true`:
3. **VERIFY**: Prompt contains staleness warning OR metadata shows `stale_context_included: true`
4. **VERIFY**: Warning is clear and actionable

### Artifact Sign-off Template

```
Artifact Review Sign-off
========================
Date: ___________
Reviewer: ___________
Artifact Set: ___________

Privacy Check:
[ ] No SSN patterns found
[ ] No credit card patterns found
[ ] No API key patterns found

Minimality Check:
[ ] Token budget respected
[ ] Decisions documented

Staleness Check:
[ ] Warnings present where expected

Signature: ___________
```

---

## API Behavior Verification

### Purpose
Manually verify API endpoints behave correctly under edge cases.

### Prerequisites
- RAL API running (local or staging)
- API client (curl, Postman, or httpie)
- Valid API key for test tenant

### Procedure

#### AB-001: Context Creation
```bash
curl -X POST http://localhost:8000/api/v1/contexts \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "context_type": "location",
    "data": {"city": "San Francisco"},
    "confidence": 0.9
  }'
```
**VERIFY**: 
- 201 Created response
- Response includes `id`, `created_at`
- `drift_status` is `STABLE`

#### AB-002: Context with TTL
```bash
curl -X POST http://localhost:8000/api/v1/contexts \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "context_type": "session",
    "data": {"session_id": "test-123"},
    "ttl_minutes": 30
  }'
```
**VERIFY**:
- `ttl_minutes` field persisted
- After 30 minutes, context marked stale

#### AB-003: Cross-Tenant Access Blocked
1. Get context ID from Tenant A
2. Attempt to read with Tenant B API key:
```bash
curl http://localhost:8000/api/v1/contexts/{CONTEXT_ID} \
  -H "Authorization: Bearer $TENANT_B_KEY"
```
**VERIFY**: 403 Forbidden OR 404 Not Found

#### AB-004: Drift Detection Trigger
```bash
# Record 3 corrections
for i in {1..3}; do
  curl -X POST http://localhost:8000/api/v1/contexts/{ID}/corrections \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"corrected_value": {"city": "City'$i'"}}'
done

# Check drift status
curl http://localhost:8000/api/v1/contexts/{ID} \
  -H "Authorization: Bearer $API_KEY"
```
**VERIFY**: `drift_status` is `CONFLICTING`

---

## Security Boundary Testing

### Purpose
Manually verify security boundaries are enforced.

### Prerequisites
- Multiple test tenants configured
- Network access to API

### Procedure

#### SB-001: JWT Token Manipulation
1. Obtain valid JWT for Tenant A
2. Decode JWT (jwt.io)
3. Modify `tenant_id` to Tenant B's ID
4. Re-encode (will have invalid signature)
5. Attempt API call
**VERIFY**: 401 Unauthorized

#### SB-002: SQL Injection Attempt
```bash
curl -X POST http://localhost:8000/api/v1/contexts \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "context_type": "test",
    "data": {"name": "Robert'\''); DROP TABLE contexts;--"}
  }'
```
**VERIFY**: 
- Request either rejected or safely escaped
- Database intact (run count query)

#### SB-003: PII in Error Messages
1. Send malformed request with PII in body
2. Trigger error
3. Check error response
**VERIFY**: Error message does not echo back PII

#### SB-004: Rate Limiting
```bash
for i in {1..100}; do
  curl http://localhost:8000/api/v1/contexts -H "Authorization: Bearer $API_KEY" &
done
wait
```
**VERIFY**: After threshold, requests return 429 Too Many Requests

---

## Performance Sanity Checks

### Purpose
Verify system performs within acceptable bounds.

### Prerequisites
- Load testing tool (k6, locust, or ab)
- RAL running with production-like data

### Procedure

#### PS-001: Context Lookup Latency
1. Create 1000 contexts for test tenant
2. Measure single context lookup:
```bash
time curl http://localhost:8000/api/v1/contexts/{ID} \
  -H "Authorization: Bearer $API_KEY"
```
**VERIFY**: p99 latency < 100ms

#### PS-002: Prompt Composition Time
1. Create context with 50 items
2. Measure composition:
```bash
time curl -X POST http://localhost:8000/api/v1/compose \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is my context?", "max_tokens": 500}'
```
**VERIFY**: Response time < 500ms

#### PS-003: Drift Detection Batch
1. Queue 100 contexts for drift detection
2. Measure batch processing time
**VERIFY**: Batch completes in < 10 seconds

---

## Verification Checklist

Use this checklist before declaring RAL "deployable":

### Core Functionality
- [ ] DV-001: Drift status correctly displayed
- [ ] DV-002: Staleness indicators working
- [ ] DV-003: Tenant isolation in dashboard
- [ ] DV-004: Health scores accurate

### Privacy & Security
- [ ] PR-001: No PII in prompt artifacts
- [ ] SB-001: JWT manipulation blocked
- [ ] SB-002: SQL injection prevented
- [ ] SB-003: No PII in error messages
- [ ] SB-004: Rate limiting active

### API Behavior
- [ ] AB-001: Context creation works
- [ ] AB-002: TTL respected
- [ ] AB-003: Cross-tenant blocked
- [ ] AB-004: Drift detection triggers

### Performance
- [ ] PS-001: Lookup latency acceptable
- [ ] PS-002: Composition time acceptable
- [ ] PS-003: Batch processing acceptable

### Sign-off

```
Manual Verification Complete
============================
Date: ___________
Environment: ___________
Tester: ___________

All checks passed: [ ] Yes  [ ] No

If No, blocking issues:
1. ___________
2. ___________

Signature: ___________
```

---

## Appendix: Test Data Setup

### Creating Test Tenants
```sql
INSERT INTO tenants (id, name, slug, api_key) VALUES
  ('t1-uuid', 'Test Tenant A', 'test-a', 'test-api-key-a'),
  ('t2-uuid', 'Test Tenant B', 'test-b', 'test-api-key-b');
```

### Creating Test Users
```sql
INSERT INTO users (id, tenant_id, email, external_id) VALUES
  ('u1-uuid', 't1-uuid', 'user@tenant-a.com', 'ext-a-1'),
  ('u2-uuid', 't2-uuid', 'user@tenant-b.com', 'ext-b-1');
```

### Creating Test Contexts
```sql
INSERT INTO contexts (id, user_id, context_type, data, confidence) VALUES
  ('c1-uuid', 'u1-uuid', 'location', '{"city": "SF"}', 0.9),
  ('c2-uuid', 'u2-uuid', 'location', '{"city": "NYC"}', 0.8);
```
