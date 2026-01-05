# Changelog

All notable changes to RAL (Reality Anchoring Layer) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-01-04

### 🎉 First Major Release - "Extreme Intelligence Engine"

This is the first stable release of RAL, representing months of development and iteration.
RAL provides the context layer that LLMs cannot access on their own.

### Core Features

#### Structural Intelligence
- **DOM Topology Mapping** - Visual hierarchy detection, not fragile regex patterns
- **Interaction Telemetry** - Scroll velocity, dwell time, behavior pattern tracking
- **CSS-Inferred Intelligence** - Computed styles → error detection (red text, warning colors)
- **Shadow DOM Traversal** - Full web component support for modern frameworks
- **Context Pivot Detection** - Automatic topic drift awareness with FIFO history
- **Contextual Proximity** - Captures surrounding code for better context
- **Parent Walker Algorithm** - Robust context retrieval across z-index layers
- **Telemetry State Hygiene** - Memory management, automatic cleanup after 30min inactivity
- **Copy-Intent Prediction** - Clipboard metadata with predicted next action

#### Behavioral Intelligence
- **Frustration Heuristic** - UX psychology-based detection
  - Repeated selection detection (5+ same text in 45 seconds)
  - Rage click detection (7+ clustered clicks in 1.5 seconds)
  - Erratic mouse movement detection (circular/chaotic patterns)
  - Adaptive baselines that learn user's normal interaction patterns
  - Confirmation mechanism to prevent false positives
  - 15-second auto-reset for quick state recovery

#### Unified Reality
- **Cross-Tab Semantic Fusion** - BroadcastChannel API integration
  - Shares research context across all browser tabs
  - Unified topic tracking across domains
  - Active research thread awareness

#### Environment Awareness
- **Hardware-Aware Reality** - Battery and Network API integration
  - Battery level and charging state
  - Network quality detection with honest API limitation handling
  - System constraint detection (low power, slow network modes)
  - LLM hints for constrained environments

#### Privacy-First Design
- **Privacy Scrubbing** - Automatic PII and secret masking
  - API keys (OpenAI, Anthropic, AWS, Stripe, GitHub, Google)
  - Email addresses (preserves domain for context)
  - IP addresses (IPv4 and IPv6)
  - Passwords and secrets in config files
  - JWT tokens and private keys

#### Intelligence Layer
- **Evidence-Based Inference** - Multi-signal convergence system
  - Confidence-weighted scoring across all detection methods
  - Source tracking for explainability
  - DSA/competitive programming detection
  - Code vs error vs question classification

- **Adaptive Context Compression** - Loss-aware compression
  - Cognitive state awareness (minimal compression when frustrated)
  - Smart truncation (preserves head + tail)
  - Field-level granularity with reversibility hints

### Technical Specifications
- **Browser Support**: Chrome/Edge 120+, Firefox 115+, Safari 17+
- **Manifest Version**: V3 (Chrome Extension standard)
- **Web Standards**: ES2024, BroadcastChannel API, Battery API, Network Information API
- **Lines of Code**: ~2800 (selection-tracker.js), ~1450 (service-worker.js)

### Known Limitations
- Network Information API cannot detect 5G (Web API limitation, not a bug)
- Battery API may not be available in all browsers/contexts
- Cross-tab fusion requires same browser profile

---

## [0.5.1] - 2026-01-04

### Fixed
- PIL import error in generate_icons.py (added type: ignore comment)
- Network detection now uses honest reporting instead of unreliable speed guessing
- Frustration detection adaptive baseline formula corrected

## [0.5.0] - 2026-01-04

### Added
- v4.0 "Extreme Intelligence" features
- Frustration Heuristic module
- Cross-Tab Semantic Fusion (BroadcastChannel)
- Hardware-Aware Reality (Battery/Network APIs)
- Privacy Scrubbing (PII masking)
- Evidence-based inference system
- Adaptive context compression

## [0.4.0] - 2026-01-03

### Added
- Structural Intelligence features
- DOM Topology Mapping
- CSS-Inferred Intelligence
- Shadow DOM Traversal
- Context Pivot Detection
- Telemetry State Hygiene

## [0.3.0] - 2026-01-02

### Added
- Interaction Telemetry
- Scroll velocity tracking
- Dwell time measurement
- Reading mode detection

## [0.2.0] - 2026-01-01

### Added
- Basic selection tracking
- Clipboard integration
- Page content extraction
- User profile persistence

## [0.1.0] - 2025-12-30

### Added
- Initial extension scaffold
- Manifest V3 setup
- Basic popup UI
- Background service worker

---

## Roadmap

### v1.1.0 (Planned)
- [ ] Dashboard UI for context visualization
- [ ] Export/import user profiles
- [ ] Custom detection rules

### v1.2.0 (Planned)
- [ ] Server mode for team sharing
- [ ] Analytics dashboard
- [ ] Custom AI integration endpoints

### v2.0.0 (Future)
- [ ] ML-based intent prediction
- [ ] Voice context integration
- [ ] IDE plugin support
