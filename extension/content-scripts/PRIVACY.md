# Privacy Policy — Reality Anchoring Layer (RAL)

Last updated: 2026

---

## Overview

Reality Anchoring Layer (RAL) is designed as a **local-first, privacy-preserving intelligence layer** for AI systems.

RAL does not operate as a data collection service, analytics platform, or background telemetry system. Its architecture is explicitly designed to give users **sovereignty over their own contextual data** while interacting with AI tools.

This document explains **what data RAL can access**, **how it is processed**, and **why it does not constitute spyware**.

---

## Core Privacy Principles

RAL is built on the following non-negotiable principles:

1. **Local-First by Default**  
   All context processing happens locally in the user’s browser.

2. **Explicit User Intent Required**  
   Context is only injected into AI prompts when the user explicitly interacts with an AI interface (e.g., clicking “Send”).

3. **Zero Telemetry Architecture**  
   RAL does not collect, transmit, or store user data for analytics, logging, or monitoring purposes.

4. **No Background Exfiltration**  
   Data never leaves the browser without the user’s direct action.

5. **Hard Privacy Boundaries**  
   Certain domains and data types are technically excluded from inspection by design.

---

## What Data RAL Can Access

RAL may temporarily process the following **only in local memory**:

- Text explicitly selected by the user
- Active page metadata (title, URL)
- Temporal context (time of day, session timing)
- Interaction patterns (e.g., dwell time, navigation flow)
- Public captions from media players (where available)

This data exists only in volatile memory (RAM) and is discarded automatically.

---

## What RAL Does NOT Do

RAL **does not**:

- Track users across websites
- Upload browsing history
- Record keystrokes
- Store raw context in databases
- Send data to third-party servers
- Run hidden analytics or telemetry
- Perform background network requests
- Identify users or create profiles tied to identity

---

## Financial & Sensitive Domain Protection

RAL enforces **hard architectural exclusions** for sensitive domains.

### Indian Banking Domains (RBI Compliance)

All domains ending in: *.bank.in are **permanently excluded** from inspection.

On these domains:
- Content scripts do not execute
- No DOM access occurs
- No selections are captured
- No context is aggregated
- No behavioral signals are generated

This exclusion is enforced **by code**, not configuration.

---

## Domain Blacklisting

In addition to `.bank.in`, RAL excludes domains related to:

- Financial services
- Authentication flows
- Health and medical content
- Development environments
- Confidential or internal systems

Blacklisted domains are never read, logged, or processed.

---

## Selection Sanitization (PII Protection)

Before any selected text is analyzed or injected:

RAL automatically sanitizes sensitive patterns, including:

- Payment card numbers
- API keys
- Authentication tokens (e.g., JWTs)

If such data is detected, it is replaced with redacted placeholders before further processing.

---

## Visual Transparency

RAL provides visible indicators when it is actively processing context.

This ensures:
- No hidden surveillance
- No silent monitoring
- Clear user awareness

If the user navigates to a private or sensitive page, RAL activity naturally ceases.

---

## Optional Server Components

Some deployments of RAL may include optional backend services for:

- Cross-device context synchronization
- Team-based workflows
- Enterprise integrations

These components are **opt-in**, clearly separated, and documented independently.  
The browser extension itself remains fully functional without any server connection.

---

## User Control

Users retain full control at all times:

- RAL operates only in supported AI interfaces
- Context injection occurs only on user action
- Protected domains are never inspected
- No persistent storage is used without explicit configuration

---

## Why RAL Is Not Spyware

Technically, any tool that observes user context could be abused.

RAL avoids this classification because:

- It does not exfiltrate data
- It does not operate silently
- It enforces hard privacy boundaries
- It gives users agency, not surveillance
- It is transparent by design

RAL behaves like a **digital sidecar**, not a background observer.

---

## Changes to This Policy

If privacy-relevant behavior changes, this document will be updated to reflect those changes.

Architectural privacy guarantees are treated as **stable contracts**, not marketing claims.

---

## Contact

For privacy questions, audits, or concerns, please open an issue in the repository or contact the maintainers.

---

RAL exists to reduce explanation overhead — **not to reduce user privacy**.