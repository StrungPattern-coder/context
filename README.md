# Reality Anchoring Layer (RAL)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Status](https://img.shields.io/badge/status-active--development-orange.svg)](#)
[![Platform](https://img.shields.io/badge/platform-browser--native-success.svg)](#)

> **Reality-aware context injection infrastructure for AI systems.**

Reality Anchoring Layer (RAL) is a browser-native intelligence layer that gives AI systems awareness of a user’s **time, activity, intent, and working context** — automatically and continuously, without requiring the user to manually explain their situation.

RAL augments prompts sent to existing AI tools such as ChatGPT, Claude, Gemini, and local or open-source models.

---

## Motivation

Large language models are powerful but fundamentally stateless.

They do not know:
- What the user was just reading or copying
- Which error the user is currently stuck on
- Whether the user is studying, debugging, or rushing
- What tabs, topics, or projects are active
- When context has shifted across tasks

RAL bridges this gap by compiling **real-time user reality** into structured, relevance-scored context that AI systems can consume reliably.

---

## What RAL Is

RAL is **infrastructure**, not a chatbot.

It operates as a reality compiler between the browser and AI systems:
- Observes user interaction signals
- Synthesizes a unified “active reality”
- Applies decay logic to prevent stale context
- Adjusts system instructions based on cognitive state

No new UI. No workflow changes.

---

## Core Capabilities

### Reality Anchoring
- Tracks selections, copies, and active page context
- Scores relevance based on recency and intent
- Automatically deprioritizes stale information

### Cross-Tab Reality Mapping
- Maintains unified context across tabs
- Detects multi-tab research threads
- Resolves conflicting intents across pages

### Temporal Intelligence
- Understands local time, date, and day-part
- Resolves relative references like “earlier today”

### Behavioral Awareness
- Detects frustration, deep study, skimming, and rapid debugging
- Dynamically adjusts AI system instructions

### Persistent User Memory
- Learns technical stack and recurring topics
- Tracks current project and task context
- Improves relevance over time

### Privacy by Default
- All processing is local by default
- No data leaves the browser unless configured
- Server features are optional

---

## User Experience

After installation:
1. Open an AI tool
2. Ask a question normally
3. The AI receives relevant situational context automatically

No prompt engineering required.

---

## Installation (Browser Extension)

RAL is currently distributed as a developer-focused unpacked extension.

1. Clone this repository
2. Open `chrome://extensions`
3. Enable **Developer Mode**
4. Click **Load Unpacked**
5. Select the `extension/` directory

The extension activates automatically on supported platforms.

---

## Supported AI Platforms

- ChatGPT (works the best)
- Claude
- Gemini
- Perplexity
- Poe
- HuggingChat
- Ollama / LM Studio (local models)

Injection format is selected automatically per platform.

---

## System Architecture

```text
┌──────────────┐
│   Browser    │
│   (User)     │
└─────┬────────┘
      │
      ▼
┌──────────────────────────┐
│  RAL Browser Extension   │
│  (Service Worker)        │
│                          │
│  • Selection Tracking    │
│  • Reality Fusion Engine │
│  • Behavioral Analysis   │
│  • Context Decay         │
│  • Prompt Injection      │
└─────┬────────────────────┘
      │
      ▼
┌──────────────────────────┐
│   AI System (LLM)        │
│  ChatGPT / Claude / etc. │
└──────────────────────────┘

RAL reduces how much humans need to explain and increases how much AI systems actually understand.

---

## License

This project is licensed under the **Apache License 2.0**.  
See the [LICENSE.md](LICENSE.md) file for full license text and terms.