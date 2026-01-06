/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  RAL Selection Tracker v1.0.0 - Reality Anchoring Layer                   ║
 * ║  The context layer LLMs can't access                                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * RELEASE: v1.0.0 (January 2026)
 * CODENAME: "Extreme Intelligence Engine"
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ CORE INTELLIGENCE MODULES                                               │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │                                                                         │
 * │ STRUCTURAL INTELLIGENCE:                                                │
 * │  1. DOM Topology Mapping (visual hierarchy, not fragile regex)          │
 * │  2. Interaction Telemetry (scroll velocity, dwell time, patterns)       │
 * │  3. CSS-Inferred Intelligence (computed styles → error detection)       │
 * │  4. Shadow DOM Traversal (web component support)                        │
 * │  5. Context Pivot Detection (topic drift awareness)                     │
 * │  6. Contextual Proximity (surrounding code capture)                     │
 * │  7. Robust Context Retrieval (Parent Walker algorithm)                  │
 * │  8. Telemetry State Hygiene (memory management, FIFO queues)            │
 * │  9. Copy-Intent Prediction (clipboard metadata, next action)            │
 * │                                                                         │
 * │ BEHAVIORAL INTELLIGENCE:                                                │
 * │ 10. Frustration Heuristic (UX psychology, rage detection)               │
 * │     - Repeated selection detection (5+ same text in 45s)                │
 * │     - Rage click detection (7+ clustered clicks in 1.5s)                │
 * │     - Erratic mouse movement detection (circular patterns)              │
 * │     - Adaptive baselines (learns user's normal patterns)                │
 * │     - Confirmation mechanism (prevents false positives)                 │
 * │                                                                         │
 * │ UNIFIED REALITY:                                                        │
 * │ 11. Cross-Tab Semantic Fusion (BroadcastChannel API)                    │
 * │     - Shares research context across all browser tabs                   │
 * │     - Unified topic tracking, domain awareness                          │
 * │                                                                         │
 * │ ENVIRONMENT AWARENESS:                                                  │
 * │ 12. Hardware-Aware Reality (Battery/Network APIs)                       │
 * │     - Battery level & charging state                                    │
 * │     - Network quality detection (with API limitation honesty)           │
 * │     - System constraint detection (low power, slow network)             │
 * │                                                                         │
 * │ PRIVACY-FIRST:                                                          │
 * │ 13. Privacy Scrubbing (PII/API Key masking)                             │
 * │     - API keys (OpenAI, AWS, Stripe, GitHub, etc.)                      │
 * │     - Email addresses, IP addresses (v4/v6)                             │
 * │     - Passwords, secrets, JWT tokens, private keys                      │
 * │                                                                         │
 * │ INTELLIGENCE LAYER:                                                     │
 * │ 14. Evidence-Based Inference (multi-signal convergence)                 │
 * │     - Confidence-weighted scoring across detection methods              │
 * │     - Source tracking for explainability                                │
 * │                                                                         │
 * │ 15. Adaptive Context Compression (loss-aware)                           │
 * │     - Cognitive state awareness (no compression when frustrated)        │
 * │     - Smart truncation (head + tail preservation)                       │
 * │     - Field-level granularity with reversibility hints                  │
 * │                                                                         │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * BROWSER SUPPORT: Chrome/Edge 120+, Firefox 115+, Safari 17+
 * WEB STANDARDS: 2026-ready (ES2024, Manifest V3, BroadcastChannel)
 * 
 * @author RAL Team
 * @license MIT
 */

// Cache for code container detection (performance)
let _codeContainerCache = null;
let _lastDOMScan = 0;

(function() {
  'use strict';
  
  // Don't run on AI chat pages
  function isAIChatUI() {
    return (
      document.querySelector('[contenteditable="true"][role="textbox"]') &&
      document.body.innerText.length > 2000
    );
  }
  
  if (isAIChatUI()) {
    return;
  }
  
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  // Configuration constants for telemetry hygiene
  const TELEMETRY_CONFIG = {
    MAX_SCROLL_SAMPLES: 20,
    MAX_SELECTION_EVENTS: 50,
    MAX_COPY_EVENTS: 20,
    MAX_TOPIC_HISTORY: 10,  // Strict FIFO cap
    INACTIVITY_THRESHOLD_MS: 30 * 60 * 1000, // 30 minutes
    
    // v4.0 Frustration Detection - TUNED FOR REAL USAGE (not test cases)
    FRUSTRATION_WINDOW_MS: 45 * 1000, // 45 seconds (was 60s - tighter window)
    FRUSTRATION_THRESHOLD: 5, // Need 5+ repeated selections (was 3 - too sensitive)
    FRUSTRATION_MIN_TEXT_LENGTH: 20, // Ignore very short selections
    RAGE_CLICK_THRESHOLD: 7, // 7+ clicks (was 5 - normal double/triple clicks)
    RAGE_CLICK_WINDOW_MS: 1500, // 1.5 seconds (was 2s)
    RAGE_MOVEMENT_MIN_SAMPLES: 30, // Need more samples (was 20)
    RAGE_MOVEMENT_DIRECTION_CHANGES: 10, // More direction changes needed (was 6)
    RAGE_MOVEMENT_MIN_DISTANCE: 800, // More movement needed (was 500)
    
    MAX_GLOBAL_RESEARCH_THREADS: 10, // Cross-tab context limit
  };
  
  // ============================================================================
  // UNIFIED EVIDENCE SCORING (v4.1)
  // ============================================================================

  function createEvidenceBucket() {
    return {
      code: [],
      error: [],
      dsa: [],
      question: [],
      text: [],
    };
  }

  function addEvidence(bucket, type, source, confidence) {
    if (!bucket[type]) return;
    bucket[type].push({ source, confidence });
  }

  function resolveFinalInference(bucket) {
    let bestType = 'text';
    let bestScore = 0;

    for (const [type, signals] of Object.entries(bucket)) {
      const score = signals.reduce((s, v) => s + v.confidence, 0);
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }

    return {
      type: bestType,
      confidence: Math.min(1, bestScore),
      sources: bucket[bestType]?.map(s => s.source) || [],
    };
  }

  const state = {
    lastSelection: '',
    selectionTimeout: null,
    selectionStartTime: null,
    lastTopic: null,
    lastDomain: null,
    lastActivityTime: Date.now(), // Track activity for hygiene
    
    // Interaction Telemetry
    telemetry: {
      scrollEvents: [],
      selectionEvents: [],
      copyEvents: [],
      readingMode: 'normal', // 'deep_study', 'quick_troubleshooting', 'skimming'
      cognitiveLoad: 'normal', // 'high', 'normal', 'low', 'FRUSTRATED'
    },
    
    // Topic tracking for context pivot (FIFO queue, max 10)
    topicHistory: [],
    
    // v4.0: Frustration Tracking
    frustration: {
      selectionHistory: [], // { text: string, timestamp: number, hash: string }
      clickHistory: [],     // { timestamp: number, x: number, y: number, target: string }
      mouseMovements: [],   // { timestamp: number, x: number, y: number }
      lastFrustrationSignal: null,
      isCurrentlyFrustrated: false,
    },
    
    // v4.0: Cross-Tab Global Context (Unified Reality)
    globalContext: {
      active_research_threads: [],
      lastBroadcast: null,
      connectedTabs: 0,
    },
    
    // v4.0: Hardware/System Telemetry
    systemTelemetry: {
      battery_level: null,
      is_charging: null,
      connection_type: null, // '4g', '3g', 'wifi', etc.
      save_data_mode: false,
      system_constraint: null, // 'low_power_optimized', 'offline_mode', null
    },
  };
  
  // ============================================================================
  // TELEMETRY STATE HYGIENE
  // ============================================================================
  
  /**
   * Flush telemetry data to prevent memory bloat
   * Called on CONTEXT_PIVOT or after 30 min inactivity
   */
  function flushTelemetry(reason = 'manual') {
    console.log(`RAL: Flushing telemetry (reason: ${reason})`);
    
    // Clear scroll samples
    scrollSamples = [];
    
    // Clear telemetry events
    state.telemetry.scrollEvents = [];
    state.telemetry.selectionEvents = [];
    state.telemetry.copyEvents = [];
    
    // Reset reading mode and cognitive load
    state.telemetry.readingMode = 'normal';
    state.telemetry.cognitiveLoad = 'normal';
    
    // Update activity timestamp
    state.lastActivityTime = Date.now();
  }
  
  /**
   * Check for inactivity and flush if needed
   */
  function checkInactivityAndFlush() {
    const now = Date.now();
    const timeSinceActivity = now - state.lastActivityTime;
    
    if (timeSinceActivity > TELEMETRY_CONFIG.INACTIVITY_THRESHOLD_MS) {
      flushTelemetry('inactivity_30min');
    }
  }
  
  /**
   * Update activity timestamp (call on user interactions)
   */
  function updateActivityTimestamp() {
    state.lastActivityTime = Date.now();
  }
  
  /**
   * Add topic to history with strict FIFO enforcement
   */
  function addToTopicHistory(topicEntry) {
    state.topicHistory.push(topicEntry);
    
    // Strict FIFO: remove oldest entries if over limit
    while (state.topicHistory.length > TELEMETRY_CONFIG.MAX_TOPIC_HISTORY) {
      state.topicHistory.shift();
    }
  }
  
  // Periodic inactivity check (every 5 minutes)
  setInterval(checkInactivityAndFlush, 5 * 60 * 1000);
  
  // ============================================================================
  // v4.0 MODULE 1: CROSS-TAB SEMANTIC FUSION (BroadcastChannel)
  // ============================================================================
  
  /**
   * The Broadcast Bridge - Unified Reality across all browser tabs
   * Channel: RAL_UNIFIED_REALITY
   */
  let unifiedRealityChannel = null;
  
  function initializeBroadcastChannel() {
    try {
      unifiedRealityChannel = new BroadcastChannel('RAL_UNIFIED_REALITY');
      
      // Listen for broadcasts from other tabs
      unifiedRealityChannel.onmessage = (event) => {
        handleCrossTabBroadcast(event.data);
      };
      
      // Announce this tab's presence
      broadcastPresence();
      
      console.log('RAL v4.0: BroadcastChannel initialized - Unified Reality active');
    } catch (e) {
      console.warn('RAL v4.0: BroadcastChannel not supported', e);
    }
  }
  
  /**
   * Broadcast selection/copy data to all tabs
   */
  function broadcastToUnifiedReality(topics, analysisType, pageInfo) {
    if (!unifiedRealityChannel) return;
    
    const broadcast = {
      type: 'RESEARCH_UPDATE',
      tabId: getTabIdentifier(),
      timestamp: Date.now(),
      domain: pageInfo.domain,
      url: pageInfo.url,
      topics: topics,
      analysisType: analysisType,
      title: pageInfo.title,
    };
    
    try {
      unifiedRealityChannel.postMessage(broadcast);
      state.globalContext.lastBroadcast = Date.now();
    } catch (e) {
      // Channel may be closed
    }
  }
  
  /**
   * Handle incoming broadcasts from other tabs
   */
  function handleCrossTabBroadcast(data) {
    if (data.type === 'RESEARCH_UPDATE' && data.tabId !== getTabIdentifier()) {
      // Add to active research threads
      const thread = {
        domain: data.domain,
        url: data.url,
        topics: data.topics,
        analysisType: data.analysisType,
        title: data.title,
        timestamp: data.timestamp,
        tabId: data.tabId,
      };
      
      // Update or add thread (avoid duplicates from same tab)
      const existingIndex = state.globalContext.active_research_threads
        .findIndex(t => t.tabId === data.tabId);
      
      if (existingIndex >= 0) {
        state.globalContext.active_research_threads[existingIndex] = thread;
      } else {
        state.globalContext.active_research_threads.push(thread);
      }
      
      // Enforce FIFO limit
      while (state.globalContext.active_research_threads.length > TELEMETRY_CONFIG.MAX_GLOBAL_RESEARCH_THREADS) {
        state.globalContext.active_research_threads.shift();
      }
      
      // Clean old threads (older than 30 minutes)
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
      state.globalContext.active_research_threads = state.globalContext.active_research_threads
        .filter(t => t.timestamp > thirtyMinutesAgo);
      
      console.log('RAL v4.0: Cross-tab update from', data.domain, '| Active threads:', 
                  state.globalContext.active_research_threads.length);
    }
    
    if (data.type === 'TAB_PRESENCE') {
      state.globalContext.connectedTabs++;
    }
  }
  
  /**
   * Announce tab presence to other tabs
   */
  function broadcastPresence() {
    if (!unifiedRealityChannel) return;
    
    try {
      unifiedRealityChannel.postMessage({
        type: 'TAB_PRESENCE',
        tabId: getTabIdentifier(),
        domain: window.location.hostname,
        timestamp: Date.now(),
      });
    } catch (e) {}
  }
  
  /**
   * Get unique tab identifier
   */
  function getTabIdentifier() {
    if (!window._ralTabId) {
      window._ralTabId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    return window._ralTabId;
  }
  
  /**
   * Build global context payload for LLM
   */
  function buildGlobalContextPayload() {
    const threads = state.globalContext.active_research_threads;
    
    if (threads.length === 0) return null;
    
    // Group by domain for cleaner output
    const byDomain = {};
    threads.forEach(t => {
      if (!byDomain[t.domain]) {
        byDomain[t.domain] = [];
      }
      byDomain[t.domain].push({
        topics: t.topics,
        analysisType: t.analysisType,
        title: t.title,
        age_minutes: Math.round((Date.now() - t.timestamp) / 60000),
      });
    });
    
    return {
      active_research_threads: threads.map(t => ({
        domain: t.domain,
        topics: t.topics,
        type: t.analysisType,
        title: t.title?.substring(0, 100),
      })),
      domains_in_use: Object.keys(byDomain),
      thread_count: threads.length,
      unified_topics: [...new Set(threads.flatMap(t => t.topics || []))],
    };
  }
  
  // Initialize BroadcastChannel
  initializeBroadcastChannel();
  
  // ============================================================================
  // v4.0 MODULE 2: FRUSTRATION HEURISTIC (UX Psychology)
  // ============================================================================
  
  /**
   * Hash text for comparison (using more robust FNV-1a hash)
   */
  function simpleHash(text) {
    // FNV-1a hash for better distribution
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619); // FNV prime
    }
    return (hash >>> 0).toString(36); // Ensure positive
  }
  
  /**
   * Normalize text for comparison (remove whitespace variations)
   */
  function normalizeTextForComparison(text) {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .toLowerCase();
  }
  
  /**
   * Track selection for frustration detection
   * INTELLIGENT: Only triggers on genuine repeated selection of same content
   */
  function trackSelectionForFrustration(text) {
    const now = Date.now();
    
    // FILTER 1: Ignore very short selections (likely accidental)
    if (!text || text.length < TELEMETRY_CONFIG.FRUSTRATION_MIN_TEXT_LENGTH) {
      return;
    }
    
    // FILTER 2: Ignore selections that are just numbers or single words
    const normalizedText = normalizeTextForComparison(text);
    if (/^\d+$/.test(normalizedText) || normalizedText.split(' ').length < 2) {
      return;
    }
    
    const hash = simpleHash(normalizedText);
    
    // Clean old entries first
    state.frustration.selectionHistory = state.frustration.selectionHistory
      .filter(s => now - s.timestamp < TELEMETRY_CONFIG.FRUSTRATION_WINDOW_MS);
    
    // Check if this EXACT text was selected before (double verify with text comparison)
    const previousSelections = state.frustration.selectionHistory.filter(s => {
      // Hash match AND text prefix match (guards against hash collisions)
      return s.hash === hash && 
             s.text.substring(0, 50) === normalizedText.substring(0, 50);
    });
    
    // Add current selection
    state.frustration.selectionHistory.push({
      text: normalizedText.substring(0, 200),
      hash: hash,
      timestamp: now,
    });
    
    // INTELLIGENT FRUSTRATION DETECTION:
    // Need 5+ selections of EXACT same text in 45 seconds
    // AND the selections should be spaced out (not just holding selection)
    if (previousSelections.length >= TELEMETRY_CONFIG.FRUSTRATION_THRESHOLD - 1) {
      // Verify selections are actually separate events (at least 500ms apart)
      const timestamps = [...previousSelections.map(s => s.timestamp), now].sort();
      let validGaps = 0;
      for (let i = 1; i < timestamps.length; i++) {
        if (timestamps[i] - timestamps[i-1] > 500) {
          validGaps++;
        }
      }
      
      // Need at least (threshold - 1) valid gaps between selections
      if (validGaps >= TELEMETRY_CONFIG.FRUSTRATION_THRESHOLD - 1) {
        triggerFrustrationSignal('repeated_selection', {
          text: text.substring(0, 100),
          count: previousSelections.length + 1,
          window_seconds: TELEMETRY_CONFIG.FRUSTRATION_WINDOW_MS / 1000,
          valid_gaps: validGaps,
        });
        
        // Clear history after triggering to prevent repeated triggers
        state.frustration.selectionHistory = [];
      }
    }
  }
  
  // Adaptive interaction baseline for frustration threshold
  let interactionBaseline = { 
    avgClicksPerSecond: 0.5,
    lastClickTime: 0,
    clicksInCurrentSecond: 0,
  };

  /**
   * Track clicks for rage click detection
   * INTELLIGENT: Differentiates normal clicks from rage clicks
   */
  function trackClickForFrustration(event) {
    const now = Date.now();
    const target = event.target;
    
    // FILTER: Only track clicks that could indicate frustration
    // Ignore normal UI interactions (buttons, links, inputs)
    const tagName = target.tagName?.toLowerCase();
    if (['button', 'a', 'input', 'select', 'textarea', 'label'].includes(tagName)) {
      return; // Normal UI interaction
    }
    
    // Identify if click is on a code container
    const isCodeContainer = isElementInCodeContainer(target);
    
    // Clean old clicks
    state.frustration.clickHistory = state.frustration.clickHistory
      .filter(c => now - c.timestamp < TELEMETRY_CONFIG.RAGE_CLICK_WINDOW_MS);
    
    state.frustration.clickHistory.push({
      timestamp: now,
      x: event.clientX,
      y: event.clientY,
      target: tagName,
      isCodeContainer: isCodeContainer,
    });
    
    // Update adaptive click baseline (proper exponential moving average)
    const secondBoundary = Math.floor(now / 1000);
    const lastSecondBoundary = Math.floor(interactionBaseline.lastClickTime / 1000);
    
    if (secondBoundary === lastSecondBoundary) {
      interactionBaseline.clicksInCurrentSecond++;
    } else {
      // New second - update EMA with actual clicks from last second
      if (interactionBaseline.lastClickTime > 0) {
        interactionBaseline.avgClicksPerSecond = 
          interactionBaseline.avgClicksPerSecond * 0.8 + 
          interactionBaseline.clicksInCurrentSecond * 0.2;
      }
      interactionBaseline.clicksInCurrentSecond = 1;
    }
    interactionBaseline.lastClickTime = now;
    
    // INTELLIGENT RAGE CLICK DETECTION:
    // Need adaptive threshold of clicks in 1.5 seconds AND clicks must be in similar location
    const adaptiveClickThreshold = Math.max(
      TELEMETRY_CONFIG.RAGE_CLICK_THRESHOLD,
      Math.ceil(interactionBaseline.avgClicksPerSecond * 4) // 4x their normal rate
    );
    if (state.frustration.clickHistory.length >= adaptiveClickThreshold) {
      const clicks = state.frustration.clickHistory;
      
      // Check if clicks are clustered (within 100px radius)
      const centerX = clicks.reduce((sum, c) => sum + c.x, 0) / clicks.length;
      const centerY = clicks.reduce((sum, c) => sum + c.y, 0) / clicks.length;
      
      const clusteredClicks = clicks.filter(c => {
        const dist = Math.sqrt(Math.pow(c.x - centerX, 2) + Math.pow(c.y - centerY, 2));
        return dist < 100; // Within 100px of center
      });
      
      // Only trigger if clicks are clustered (same spot clicking)
      if (clusteredClicks.length >= adaptiveClickThreshold) {
        // Additional check: at least some clicks on code container
        const codeClicks = clusteredClicks.filter(c => c.isCodeContainer);
        
        triggerFrustrationSignal('rage_clicks', {
          click_count: clusteredClicks.length,
          window_ms: TELEMETRY_CONFIG.RAGE_CLICK_WINDOW_MS,
          target_type: codeClicks.length > 0 ? 'code_container' : 'general',
          cluster_radius: 100,
        });
        
        // Clear history after triggering
        state.frustration.clickHistory = [];
      }
    }
  }
  
  /**
   * Track mouse movements for rage movement detection
   * INTELLIGENT: Requires sustained erratic movement pattern
   */
  function trackMouseForFrustration(event) {
    const now = Date.now();
    
    // Clean old movements first
    state.frustration.mouseMovements = state.frustration.mouseMovements
      .filter(m => now - m.timestamp < 3000);
    
    state.frustration.mouseMovements.push({
      timestamp: now,
      x: event.clientX,
      y: event.clientY,
    });
    
    // Only check if we have enough samples (30+)
    if (state.frustration.mouseMovements.length >= TELEMETRY_CONFIG.RAGE_MOVEMENT_MIN_SAMPLES) {
      const movements = state.frustration.mouseMovements;
      const isCircular = detectCircularMovement(movements);
      
      if (isCircular) {
        triggerFrustrationSignal('rage_movement', {
          pattern: 'circular',
          movement_count: movements.length,
          window_seconds: 3,
        });
        
        // Clear after triggering
        state.frustration.mouseMovements = [];
      }
    }
  }
  
  /**
   * Detect circular mouse movement pattern
   * INTELLIGENT: Uses stricter thresholds for real frustration
   */
  function detectCircularMovement(movements) {
    if (movements.length < TELEMETRY_CONFIG.RAGE_MOVEMENT_MIN_SAMPLES) return false;
    
    // Calculate direction changes and total distance
    let directionChanges = 0;
    let totalDistance = 0;
    let lastDirection = null;
    
    for (let i = 1; i < movements.length; i++) {
      const prev = movements[i - 1];
      const curr = movements[i];
      
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      totalDistance += distance;
      
      // Calculate direction (in 8 segments)
      if (distance > 5) { // Ignore tiny movements
        const angle = Math.atan2(dy, dx);
        const direction = Math.floor((angle + Math.PI) / (Math.PI / 4)) % 8;
        
        if (lastDirection !== null && direction !== lastDirection) {
          directionChanges++;
        }
        lastDirection = direction;
      }
    }
    
    // INTELLIGENT: Requires significant movement (800+ px) with many direction changes (10+)
    // This filters out normal mouse movement and only catches erratic "rage" patterns
    const isErratic = directionChanges >= TELEMETRY_CONFIG.RAGE_MOVEMENT_DIRECTION_CHANGES && 
                      totalDistance > TELEMETRY_CONFIG.RAGE_MOVEMENT_MIN_DISTANCE;
    
    return isErratic;
  }
  
  /**
   * Check if element is inside a code container
   */
  function isElementInCodeContainer(element) {
    if (!element) return false;
    
    const codeContainers = identifyCodeContainers();
    return codeContainers.some(c => c.element.contains(element));
  }
  
  /**
   * Trigger frustration signal
   * INTELLIGENT: Requires confirmation before marking frustrated
   * Uses longer debounce and shorter auto-reset for better UX
   */
  function triggerFrustrationSignal(reason, details) {
    const now = Date.now();
    
    // LONGER DEBOUNCE: 30 seconds between frustration signals (was 10s)
    // This prevents false positives from quick interactions
    if (state.frustration.lastFrustrationSignal && 
        now - state.frustration.lastFrustrationSignal < 30000) {
      return; // Don't spam signals
    }
    
    // CONFIRMATION MECHANISM: Require 2+ frustration events in 2 minutes
    // to actually mark as frustrated (guards against single false positives)
    state.frustration.frustrationEvents = state.frustration.frustrationEvents || [];
    state.frustration.frustrationEvents.push({ reason, timestamp: now });
    state.frustration.frustrationEvents = state.frustration.frustrationEvents
      .filter(e => now - e.timestamp < 120000); // Keep last 2 minutes
    
    // Need at least 2 different frustration signals to confirm frustration
    const uniqueReasons = new Set(state.frustration.frustrationEvents.map(e => e.reason));
    const isConfirmedFrustration = state.frustration.frustrationEvents.length >= 2 || 
                                    uniqueReasons.size >= 2;
    
    state.frustration.lastFrustrationSignal = now;
    
    // Only mark as FRUSTRATED if confirmed
    if (isConfirmedFrustration) {
      state.frustration.isCurrentlyFrustrated = true;
      state.telemetry.cognitiveLoad = 'FRUSTRATED';
      console.log('RAL v4.0: 🔴 FRUSTRATION_CONFIRMED -', reason, details);
    } else {
      // First signal - mark as "elevated" not frustrated
      state.telemetry.cognitiveLoad = 'elevated';
      console.log('RAL v4.0: ⚠️ FRUSTRATION_SIGNAL -', reason, '(awaiting confirmation)');
    }
    
    // Emit event
    try {
      chrome.runtime.sendMessage({
        type: 'FRUSTRATION_DETECTED',
        payload: {
          reason: reason,
          details: details,
          timestamp: now,
          url: window.location.href,
          domain: window.location.hostname,
          cognitiveState: isConfirmedFrustration ? 'FRUSTRATED' : 'elevated',
          confirmed: isConfirmedFrustration,
        }
      });
    } catch (e) {
      // Extension context may be invalidated
    }
    
    // SHORTER AUTO-RESET: 15 seconds (was 30s) - frustration state should clear quickly
    // once user has gotten what they need
    setTimeout(() => {
      state.frustration.isCurrentlyFrustrated = false;
      if (state.telemetry.cognitiveLoad === 'FRUSTRATED' || state.telemetry.cognitiveLoad === 'elevated') {
        state.telemetry.cognitiveLoad = 'normal'; // Reset to normal, not high
        console.log('RAL v4.0: Frustration state reset to normal');
      }
    }, 15000);
  }
  
  /**
   * Main frustration tracking function
   */
  function trackUserFrustration(eventType, event, text = null) {
    switch (eventType) {
      case 'selection':
        if (text) trackSelectionForFrustration(text);
        break;
      case 'click':
        trackClickForFrustration(event);
        break;
      case 'mousemove':
        trackMouseForFrustration(event);
        break;
    }
  }
  
  // Throttled mouse move listener for rage detection
  let mouseThrottleTimer = null;
  document.addEventListener('mousemove', (event) => {
    if (!mouseThrottleTimer) {
      mouseThrottleTimer = setTimeout(() => {
        trackUserFrustration('mousemove', event);
        mouseThrottleTimer = null;
      }, 50); // Sample every 50ms
    }
  }, { passive: true });
  
  // Click listener for rage click detection
  document.addEventListener('click', (event) => {
    trackUserFrustration('click', event);
  }, { passive: true });
  
  // ============================================================================
  // v4.0 MODULE 3: HARDWARE-AWARE REALITY (Environment Ingress)
  // ============================================================================
  
  /**
   * Initialize hardware telemetry (Battery + Network APIs)
   */
  async function initializeHardwareTelemetry() {
    // Battery API
    try {
      if ('getBattery' in navigator) {
        const battery = await navigator.getBattery();
        
        // Initial state
        updateBatteryState(battery);
        
        // Listen for changes
        battery.addEventListener('chargingchange', () => updateBatteryState(battery));
        battery.addEventListener('levelchange', () => updateBatteryState(battery));
        
        console.log('RAL v4.0: Battery API initialized');
      }
    } catch (e) {
      console.warn('RAL v4.0: Battery API not available', e);
    }
    
    // Network Information API
    try {
      if ('connection' in navigator) {
        const connection = navigator.connection;
        
        // Initial state
        updateNetworkState(connection);
        
        // Listen for changes
        connection.addEventListener('change', () => updateNetworkState(connection));
        
        console.log('RAL v4.0: Network Information API initialized');
      }
    } catch (e) {
      console.warn('RAL v4.0: Network API not available', e);
    }
  }
  
  /**
   * Update battery state
   */
  function updateBatteryState(battery) {
    state.systemTelemetry.battery_level = Math.round(battery.level * 100);
    state.systemTelemetry.is_charging = battery.charging;
    
    // Check for low power constraint
    updateSystemConstraints();
  }
  
  /**
   * Update network state
   * PRAGMATIC APPROACH: The Network Information API is notoriously unreliable.
   * 
   * KNOWN LIMITATIONS:
   * - effectiveType: Only returns '4g', '3g', '2g', 'slow-2g' (NO 5G!)
   * - downlink: Often returns 0, 10, or capped values - NOT actual speed
   * - type: Returns 'wifi' for hotspots (the local link, not backhaul)
   * - rtt: Often 0 or very rough estimates
   * 
   * SOLUTION: Just report what the browser tells us honestly, with clear labeling.
   * Don't try to "guess" 5G - it's misleading. Instead, show the raw data.
   */
  function updateNetworkState(connection) {
    // Get raw values from the API
    const effectiveType = connection.effectiveType || 'unknown';
    const downlinkMbps = connection.downlink || 0;
    const rtt = connection.rtt || 0;
    const physicalType = connection.type || 'unknown';
    const saveData = connection.saveData || false;
    
    // HONEST CLASSIFICATION: Don't pretend to know more than we do
    // The browser's effectiveType is based on actual network measurements
    let displayType;
    let quality;
    
    switch (effectiveType) {
      case '4g':
        // 4g is the best the Web API can report - could be 4G, 5G, fast WiFi, etc.
        // The API has NO way to detect 5G - it maxes out at '4g'
        quality = 'good';
        // If speed > 50 Mbps, likely 5G or fast WiFi (but we can't know for sure)
        // Be honest: label as "Fast" instead of guessing 5G
        displayType = downlinkMbps >= 50 ? 'Fast (4g+)' : (downlinkMbps >= 10 ? '4g+' : '4g');
        break;
      case '3g':
        quality = 'moderate';
        displayType = '3g';
        break;
      case '2g':
      case 'slow-2g':
        quality = 'poor';
        displayType = effectiveType;
        break;
      default:
        quality = 'unknown';
        displayType = effectiveType;
    }
    
    // Store the data
    state.systemTelemetry.connection_type = displayType;
    state.systemTelemetry.connection_quality = quality;
    state.systemTelemetry.connection_details = {
      display_type: displayType,
      quality: quality,
      effective_type: effectiveType,
      physical_type: physicalType,
      downlink_mbps: downlinkMbps,
      rtt_ms: rtt,
      save_data: saveData,
      // Honest summary
      summary: `${displayType} quality:${quality} | ${downlinkMbps}Mbps ${rtt}ms | via ${physicalType}`,
      // Note about API limitations
      note: 'Web API caps at 4g - actual 5G/WiFi speed not detectable',
    };
    state.systemTelemetry.save_data_mode = saveData;
    
    console.log(`RAL v4.1: Network - ${displayType} (${quality}) | ${downlinkMbps} Mbps | ${rtt}ms RTT | ${physicalType}`);
    
    // Check for constraints
    updateSystemConstraints();
  }
  
  /**
   * Determine system constraints based on hardware state
   * INTELLIGENT: Only flags genuine constraints, not normal conditions
   */
  function updateSystemConstraints() {
    const { battery_level, is_charging, save_data_mode, connection_type } = state.systemTelemetry;
    
    // Priority 1: Low battery (< 10%) and not charging
    if (battery_level !== null && battery_level < 10 && !is_charging) {
      state.systemTelemetry.system_constraint = 'low_power_optimized';
      return;
    }
    
    // Priority 2: Save Data mode enabled
    if (save_data_mode) {
      state.systemTelemetry.system_constraint = 'data_saver_mode';
      return;
    }
    
    // Priority 3: Very slow connection (2G or slow-2g only)
    if (connection_type === 'slow-2g' || connection_type === '2g') {
      state.systemTelemetry.system_constraint = 'low_bandwidth';
      return;
    }
    
    // Priority 4: 3G is constrained but not severely
    if (connection_type === '3g') {
      state.systemTelemetry.system_constraint = 'mobile_constrained';
      return;
    }
    
    // 4G, 5G, WiFi = no constraints (these are good connections)
    state.systemTelemetry.system_constraint = null;
  }
  
  /**
   * Build system telemetry payload
   */
  function buildSystemTelemetryPayload() {
    const { battery_level, is_charging, connection_type, save_data_mode, system_constraint } = state.systemTelemetry;
    
    // Only include if we have data
    if (battery_level === null && connection_type === null) {
      return null;
    }
    
    const payload = {};
    
    if (battery_level !== null) {
      payload.battery_level = battery_level;
      payload.is_charging = is_charging;
    }
    
    if (connection_type !== null) {
      payload.connection_type = connection_type;
      payload.save_data_mode = save_data_mode;
    }
    
    if (system_constraint) {
      payload.system_constraint = system_constraint;
      
      // Add human-readable advice for the LLM
      if (system_constraint === 'low_power_optimized') {
        payload.llm_hint = 'User is on low power - prefer concise responses';
      } else if (system_constraint === 'low_bandwidth') {
        payload.llm_hint = 'User has slow connection - avoid suggesting large downloads';
      } else if (system_constraint === 'mobile_constrained') {
        payload.llm_hint = 'User is on mobile - prefer mobile-friendly solutions';
      }
    }
    
    return payload;
  }
  
  // Initialize hardware telemetry
  initializeHardwareTelemetry();
  
  // ============================================================================
  // v4.0 MODULE 4: PRIVACY SCRUBBING (PII Masking)
  // ============================================================================
  
  /**
   * Mask sensitive data before sending to background
   * Protects: API Keys, Emails, IP Addresses, Passwords, Tokens
   */
  function maskSensitiveData(text) {
    if (!text || typeof text !== 'string') return text;
    
    let masked = text;
    let maskCount = 0;
    
    // API Keys patterns (various providers)
    const apiKeyPatterns = [
      // OpenAI
      /sk-[A-Za-z0-9]{20,}/g,
      // Anthropic
      /sk-ant-[A-Za-z0-9-]{20,}/g,
      // AWS
      /AKIA[A-Z0-9]{16}/g,
      // Google
      /AIza[A-Za-z0-9_-]{35}/g,
      // Stripe
      /sk_live_[A-Za-z0-9]{24,}/g,
      /sk_test_[A-Za-z0-9]{24,}/g,
      // GitHub
      /ghp_[A-Za-z0-9]{36}/g,
      /gho_[A-Za-z0-9]{36}/g,
      /ghu_[A-Za-z0-9]{36}/g,
      // Generic API key patterns
      /api[_-]?key["']?\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}["']?/gi,
      /bearer\s+[A-Za-z0-9_-]{20,}/gi,
    ];
    
    // Email addresses
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    
    // IP Addresses (IPv4 and IPv6)
    const ipv4Pattern = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
    const ipv6Pattern = /(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}/g;
    
    // Password patterns (in config files, URLs, etc.)
    const passwordPatterns = [
      /password["']?\s*[:=]\s*["']?[^\s"',]{8,}["']?/gi,
      /pwd["']?\s*[:=]\s*["']?[^\s"',]{8,}["']?/gi,
      /secret["']?\s*[:=]\s*["']?[^\s"',]{8,}["']?/gi,
    ];
    
    // JWT Tokens
    const jwtPattern = /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g;
    
    // Private keys (PEM format)
    const privateKeyPattern = /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/g;
    
    // Apply API key masks
    for (const pattern of apiKeyPatterns) {
      masked = masked.replace(pattern, (match) => {
        maskCount++;
        return '[MASKED_API_KEY]';
      });
    }
    
    // Apply email mask
    masked = masked.replace(emailPattern, (match) => {
      maskCount++;
      // Preserve domain for context but mask user
      const parts = match.split('@');
      return `[MASKED_EMAIL]@${parts[1]}`;
    });
    
    // Apply IP masks
    masked = masked.replace(ipv4Pattern, () => {
      maskCount++;
      return '[MASKED_IPV4]';
    });
    masked = masked.replace(ipv6Pattern, () => {
      maskCount++;
      return '[MASKED_IPV6]';
    });
    
    // Apply password masks
    for (const pattern of passwordPatterns) {
      masked = masked.replace(pattern, (match) => {
        maskCount++;
        const key = match.split(/[:=]/)[0];
        return `${key}=[MASKED_SECRET]`;
      });
    }
    
    // Apply JWT mask
    masked = masked.replace(jwtPattern, () => {
      maskCount++;
      return '[MASKED_JWT]';
    });
    
    // Apply private key mask
    masked = masked.replace(privateKeyPattern, () => {
      maskCount++;
      return '[MASKED_PRIVATE_KEY]';
    });
    
    // Log if any masking occurred
    if (maskCount > 0) {
      console.log(`RAL v4.0: Privacy scrubbing applied - ${maskCount} sensitive item(s) masked`);
    }
    
    return masked;
  }
  
  /**
   * Check if text contains sensitive data (for metadata)
   */
  function containsSensitiveData(text) {
    if (!text) return false;
    
    const sensitivePatterns = [
      /sk-[A-Za-z0-9]{20,}/,
      /AKIA[A-Z0-9]{16}/,
      /api[_-]?key/i,
      /password\s*[:=]/i,
      /secret\s*[:=]/i,
      /-----BEGIN.*PRIVATE.*KEY-----/,
    ];
    
    return sensitivePatterns.some(p => p.test(text));
  }
  
  // ============================================================================
  // 1. STRUCTURAL DOM TOPOLOGY MAPPING
  // ============================================================================
  
  /**
   * Identify code containers by DOM structure, not class names
   * Uses visual hierarchy heuristics for 2026 web standards
   */
  function identifyCodeContainers(root = document) {
    const now = Date.now();
    if (_codeContainerCache && now - _lastDOMScan < 3000) {
      return _codeContainerCache;
    }
    const containers = [];
    
    // Traverse including Shadow DOM
    const walker = createDeepTreeWalker(root);
    let node;
    
    while (node = walker.nextNode()) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      
      const el = node;
      const tagName = el.tagName.toLowerCase();
      
      // Direct code elements
      if (tagName === 'pre' || tagName === 'code') {
        const style = window.getComputedStyle(el);
        if (isMonospacedFont(style)) {
          containers.push({
            element: el,
            type: 'code_block',
            confidence: 0.95,
            context: extractVisualContext(el),
          });
        }
      }
      
      // Check for code-like visual patterns (flexbox/grid layouts used by editors)
      if (hasCodeEditorTopology(el)) {
        containers.push({
          element: el,
          type: 'code_editor',
          confidence: 0.85,
          context: extractVisualContext(el),
        });
      }
      
      // H1-H4 followed by pre/code pattern (problem statements)
      if (/^h[1-4]$/i.test(tagName)) {
        const nextCodeBlock = findNextCodeBlock(el);
        if (nextCodeBlock) {
          containers.push({
            element: el.parentElement || el,
            type: 'titled_code_section',
            title: el.textContent?.trim(),
            codeBlock: nextCodeBlock,
            confidence: 0.9,
          });
        }
      }
    }
    _codeContainerCache = containers;
    _lastDOMScan = Date.now();
    return containers;
  }
  
  /**
   * Check if element has code editor topology (line numbers + code area layout)
   */
  function hasCodeEditorTopology(el) {
    const style = window.getComputedStyle(el);
    const children = el.children;
    
    // Pattern 1: Flexbox with line numbers + code
    if (style.display === 'flex' || style.display === 'grid') {
      let hasLineNumbers = false;
      let hasCodeArea = false;
      
      for (const child of children) {
        const childText = child.textContent?.trim() || '';
        const childStyle = window.getComputedStyle(child);
        
        // Line numbers: sequential numbers, narrow width
        if (/^[\d\n]+$/.test(childText.replace(/\s/g, '')) && 
            parseInt(childStyle.width) < 80) {
          hasLineNumbers = true;
        }
        
        // Code area: monospaced, contains code-like content
        if (isMonospacedFont(childStyle) && childText.length > 50) {
          hasCodeArea = true;
        }
      }
      
      return hasLineNumbers && hasCodeArea;
    }
    
    // Pattern 2: Monaco/CodeMirror editor markers
    const className = el.className?.toString() || '';
    if (/monaco|codemirror|ace-editor|prism|hljs/i.test(className)) {
      return true;
    }
    
    // Pattern 3: Role attributes
    if (el.getAttribute('role') === 'textbox' && 
        el.getAttribute('aria-multiline') === 'true' &&
        isMonospacedFont(window.getComputedStyle(el))) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Find next code block sibling after a heading
   */
  function findNextCodeBlock(heading) {
    let sibling = heading.nextElementSibling;
    let depth = 0;
    
    while (sibling && depth < 5) {
      const tag = sibling.tagName.toLowerCase();
      
      if (tag === 'pre' || tag === 'code') {
        return sibling;
      }
      
      // Check inside divs/sections
      const nestedCode = sibling.querySelector('pre, code');
      if (nestedCode) {
        return nestedCode;
      }
      
      sibling = sibling.nextElementSibling;
      depth++;
    }
    
    return null;
  }
  
  /**
   * Extract visual context from computed styles
   */
  function extractVisualContext(el) {
    const style = window.getComputedStyle(el);
    return {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      backgroundColor: style.backgroundColor,
      color: style.color,
      isMonospace: isMonospacedFont(style),
      hasBorder: style.border !== 'none' && style.borderWidth !== '0px',
      padding: style.padding,
    };
  }
  
  /**
   * Self-correction: Detect competitive programming on unknown domains
   */
  function detectCompetitiveProgrammingByContent() {
    const pageText = document.body?.textContent || '';
    
    // O(N) notation detection
    const hasComplexityNotation = /O\s*\(\s*[nNmMkK1logLOG\s\*\^\d]+\s*\)/g.test(pageText);
    
    // Example section detection
    const hasExampleSection = /example\s*\d*\s*:|sample\s*(input|output)/i.test(pageText);
    
    // Input/Output format
    const hasIOFormat = /input\s*[:format]|output\s*[:format]/i.test(pageText);
    
    // Constraints section
    const hasConstraints = /constraints?\s*:|1\s*[<≤]=\s*\w+\s*[<≤]=\s*10\^?\d/i.test(pageText);
    
    // Problem statement patterns
    const hasProblemStructure = 
      identifyCodeContainers().some(c => c.type === 'titled_code_section') &&
      (hasExampleSection || hasIOFormat);
    
    const score = [
      hasComplexityNotation,
      hasExampleSection,
      hasIOFormat,
      hasConstraints,
      hasProblemStructure,
    ].filter(Boolean).length;
    
    return {
      isCompetitiveProgramming: score >= 3,
      confidence: score / 5,
      signals: {
        hasComplexityNotation,
        hasExampleSection,
        hasIOFormat,
        hasConstraints,
        hasProblemStructure,
      }
    };
  }
  
  // ============================================================================
  // 2. INTERACTION TELEMETRY
  // ============================================================================
  
  /**
   * Track scroll velocity to infer reading mode
   */
  let lastScrollY = 0;
  let lastScrollTime = Date.now();
  let scrollSamples = [];
  
  function trackScrollVelocity() {
    const currentY = window.scrollY;
    const currentTime = Date.now();
    const deltaY = Math.abs(currentY - lastScrollY);
    const deltaTime = currentTime - lastScrollTime;
    
    if (deltaTime > 0) {
      const velocity = deltaY / deltaTime; // pixels per ms
      
      scrollSamples.push({
        velocity,
        timestamp: currentTime,
        direction: currentY > lastScrollY ? 'down' : 'up',
      });
      
      // Keep last 20 samples
      if (scrollSamples.length > 20) {
        scrollSamples.shift();
      }
      
      // Calculate average velocity
      const avgVelocity = scrollSamples.reduce((sum, s) => sum + s.velocity, 0) / scrollSamples.length;
      
      // Infer reading mode
      if (avgVelocity < 0.3) {
        state.telemetry.readingMode = 'deep_study';
      } else if (avgVelocity > 1.5) {
        state.telemetry.readingMode = 'quick_troubleshooting';
      } else {
        state.telemetry.readingMode = 'normal';
      }
    }
    
    lastScrollY = currentY;
    lastScrollTime = currentTime;
  }
  
  // Throttled scroll listener
  let scrollThrottleTimer = null;
  window.addEventListener('scroll', () => {
    if (!scrollThrottleTimer) {
      scrollThrottleTimer = setTimeout(() => {
        trackScrollVelocity();
        scrollThrottleTimer = null;
      }, 100);
    }
  }, { passive: true });
  
  /**
   * Track selection dwell time
   */
  function trackSelectionDwell() {
    if (!state.selectionStartTime) {
      state.selectionStartTime = Date.now();
    }
  }
  
  function calculateDwellTime() {
    if (!state.selectionStartTime) return 0;
    const dwell = Date.now() - state.selectionStartTime;
    state.selectionStartTime = null;
    return dwell;
  }
  
  /**
   * Infer cognitive load from dwell time
   */
  function inferCognitiveLoad(dwellTime) {
    if (dwellTime > 5000) {
      return 'high'; // User confusion / deep thinking
    } else if (dwellTime > 2000) {
      return 'medium';
    }
    return 'normal';
  }
  
  function deriveCognitiveLoad({ frustration, dwellTime, readingMode }) {
    if (frustration?.isCurrentlyFrustrated) return 'FRUSTRATED';
    if (dwellTime > 5000 || readingMode === 'deep_study') return 'high';
    if (dwellTime > 2000) return 'medium';
    return 'normal';
  }

  /**
   * Build telemetry payload (v4.0 Enhanced with Frustration + Hardware)
   */
  function buildTelemetryPayload(dwellTime) {
    const cognitiveLoad = deriveCognitiveLoad({
      frustration: state.frustration,
      dwellTime,
      readingMode: state.telemetry.readingMode,
    });
    const payload = {
      readingMode: state.telemetry.readingMode,
      cognitiveLoad: cognitiveLoad,
      dwellTimeMs: dwellTime,
      scrollVelocity: scrollSamples.length > 0 
        ? scrollSamples.reduce((sum, s) => sum + s.velocity, 0) / scrollSamples.length 
        : 0,
      recentSelections: state.telemetry.selectionEvents.length,
    };
    
    // v4.0: Add frustration data if active
    if (state.frustration.isCurrentlyFrustrated) {
      payload.frustration = {
        isActive: true,
        lastSignal: state.frustration.lastFrustrationSignal,
        recentSelectionRepeats: state.frustration.selectionHistory.length,
      };
    }
    
    // v4.0: Add system telemetry
    const systemPayload = buildSystemTelemetryPayload();
    if (systemPayload) {
      payload.system = systemPayload;
    }
    
    return payload;
  }
  
  // ============================================================================
  // 3. CSS-INFERRED INTELLIGENCE
  // ============================================================================
  
  /**
   * Analyze element's visual properties to infer content type
   */
  function analyzeVisualContext(element) {
    if (!element) return null;
    
    const style = window.getComputedStyle(element);
    const analysis = {
      isMonospace: isMonospacedFont(style),
      isErrorColored: false,
      isSyntaxHighlighted: false,
      visualType: 'text',
      confidence: 0.5,
    };
    
    // Parse colors
    const color = parseColor(style.color);
    const bgColor = parseColor(style.backgroundColor);
    
    // Error detection by color (red/orange family)
    if (color) {
      const isRedOrange = color.r > 180 && color.g < 150 && color.b < 150;
      const isOrange = color.r > 200 && color.g > 100 && color.g < 180 && color.b < 100;
      
      if ((isRedOrange || isOrange) && analysis.isMonospace) {
        analysis.isErrorColored = true;
        analysis.visualType = 'error_message';
        analysis.confidence = 0.85;
      }
    }
    
    // Syntax highlighting detection (multiple colored spans inside)
    if (analysis.isMonospace) {
      const coloredChildren = element.querySelectorAll('span[style*="color"], span[class]');
      const uniqueColors = new Set();
      
      coloredChildren.forEach(child => {
        const childStyle = window.getComputedStyle(child);
        uniqueColors.add(childStyle.color);
      });
      
      if (uniqueColors.size >= 3) {
        analysis.isSyntaxHighlighted = true;
        analysis.visualType = 'code';
        analysis.confidence = 0.9;
      }
    }
    
    // Border + monospace = code/error container
    const hasBorder = style.border !== 'none' && 
                     parseFloat(style.borderWidth) > 0;
    
    if (hasBorder && analysis.isMonospace && !analysis.isSyntaxHighlighted) {
      // Could be error or code - check for error patterns
      if (analysis.isErrorColored || /error|exception|fail|warning/i.test(element.textContent)) {
        analysis.visualType = 'error_message';
        analysis.confidence = 0.9;
      } else {
        analysis.visualType = 'code';
        analysis.confidence = 0.75;
      }
    }
    
    return analysis;
  }
  
  /**
   * Check if font is monospace
   */
  function isMonospacedFont(style) {
    const fontFamily = style.fontFamily.toLowerCase();
    const monoFonts = [
      'monospace', 'courier', 'consolas', 'monaco', 
      'menlo', 'dejavu', 'source code', 'fira code',
      'jetbrains', 'ubuntu mono', 'roboto mono', 'sf mono'
    ];
    return monoFonts.some(f => fontFamily.includes(f));
  }
  
  /**
   * Parse CSS color to RGB
   */
  function parseColor(colorStr) {
    if (!colorStr || colorStr === 'transparent') return null;
    
    // RGB/RGBA format
    const rgbMatch = colorStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3]),
      };
    }
    
    return null;
  }
  
  // ============================================================================
  // 4. SHADOW DOM TRAVERSAL
  // ============================================================================
  
  /**
   * Create a TreeWalker that traverses into open Shadow Roots
   */
  function createDeepTreeWalker(root) {
    const nodes = [];
    
    function traverse(node) {
      nodes.push(node);
      
      // Traverse shadow root if open
      if (node.shadowRoot) {
        traverse(node.shadowRoot);
      }
      
      // Traverse children
      for (const child of node.children || []) {
        traverse(child);
      }
    }
    
    traverse(root);
    
    let index = 0;
    return {
      nextNode() {
        return nodes[index++] || null;
      }
    };
  }
  
  /**
   * Query selector that searches through Shadow DOM
   */
  function deepQuerySelector(root, selector) {
    // Try regular query first
    const result = root.querySelector(selector);
    if (result) return result;
    
    // Search in shadow roots
    const walker = createDeepTreeWalker(root);
    let node;
    
    while (node = walker.nextNode()) {
      if (node.shadowRoot) {
        const shadowResult = node.shadowRoot.querySelector(selector);
        if (shadowResult) return shadowResult;
      }
    }
    
    return null;
  }
  
  /**
   * Query selector all that searches through Shadow DOM
   */
  function deepQuerySelectorAll(root, selector) {
    const results = [...root.querySelectorAll(selector)];
    
    const walker = createDeepTreeWalker(root);
    let node;
    
    while (node = walker.nextNode()) {
      if (node.shadowRoot) {
        results.push(...node.shadowRoot.querySelectorAll(selector));
      }
    }
    
    return results;
  }
  
  // ============================================================================
  // 5. CONTEXT PIVOT DETECTION
  // ============================================================================
  
  /**
   * Extract topic keywords from text
   */
  function extractTopicKeywords(text) {
    const keywords = new Set();
    
    // Tech/programming terms
    const techPatterns = [
      /\b(react|vue|angular|svelte|next\.?js|nuxt)\b/gi,
      /\b(python|javascript|typescript|java|c\+\+|rust|go|ruby)\b/gi,
      /\b(api|database|sql|nosql|mongodb|postgres|mysql)\b/gi,
      /\b(docker|kubernetes|aws|azure|gcp|cloud)\b/gi,
      /\b(machine\s*learning|deep\s*learning|ai|neural|nlp)\b/gi,
      /\b(algorithm|data\s*structure|tree|graph|array|hash)\b/gi,
      /\b(css|html|dom|browser|frontend|backend)\b/gi,
    ];
    
    // Science/academic terms
    const sciencePatterns = [
      /\b(physics|quantum|relativity|mechanics)\b/gi,
      /\b(biology|chemistry|genetics|molecular)\b/gi,
      /\b(mathematics|calculus|algebra|geometry)\b/gi,
      /\b(economics|finance|market|investment)\b/gi,
    ];
    
    const allPatterns = [...techPatterns, ...sciencePatterns];
    
    for (const pattern of allPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(m => keywords.add(m.toLowerCase()));
      }
    }
    
    return Array.from(keywords);
  }
  
  /**
   * Calculate topic similarity (Jaccard index)
   */
  function calculateTopicSimilarity(topics1, topics2) {
    if (!topics1?.length || !topics2?.length) return 1; // No comparison possible
    
    const set1 = new Set(topics1);
    const set2 = new Set(topics2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Detect if context has pivoted significantly
   */
  function detectContextPivot(currentTopics, currentDomain) {
    const lastTopic = state.topicHistory[state.topicHistory.length - 1];
    
    if (!lastTopic) {
      // First topic - use FIFO helper
      addToTopicHistory({ topics: currentTopics, domain: currentDomain, timestamp: Date.now() });
      return { isPivot: false };
    }
    
    const similarity = calculateTopicSimilarity(currentTopics, lastTopic.topics);
    const domainChanged = lastTopic.domain !== currentDomain;
    
    // Significant pivot: low similarity AND/OR domain change with topic change
    const isPivot = similarity < 0.2 || (domainChanged && similarity < 0.5);
    
    // Track history using FIFO helper (strictly capped at 10)
    addToTopicHistory({ topics: currentTopics, domain: currentDomain, timestamp: Date.now() });
    
    if (isPivot) {
      // CRITICAL: Flush telemetry on context pivot to prevent stale data
      flushTelemetry('context_pivot');
      
      // Emit CONTEXT_PIVOT event
      try {
        chrome.runtime.sendMessage({
          type: 'CONTEXT_PIVOT',
          payload: {
            previousTopics: lastTopic.topics,
            currentTopics: currentTopics,
            previousDomain: lastTopic.domain,
            currentDomain: currentDomain,
            similarity: similarity,
            timestamp: Date.now(),
            telemetryFlushed: true,
          }
        });
      } catch (e) {
        // Extension context may be invalidated
      }
    }
    
    return {
      isPivot,
      similarity,
      previousTopics: lastTopic.topics,
    };
  }
  
  // ============================================================================
  // 6. CONTEXTUAL PROXIMITY (with Robust Parent Walker)
  // ============================================================================
  
  /**
   * Check if an element is substantial (not a tooltip, modal header, etc.)
   * @param {Element} el - Element to check
   * @returns {boolean} - True if element has substantial content
   */
  function isSubstantialElement(el) {
    if (!el) return false;
    
    const text = el.textContent || '';
    const textLength = text.trim().length;
    
    // Get computed dimensions
    const style = window.getComputedStyle(el);
    const height = parseFloat(style.height) || el.offsetHeight || 0;
    
    // Check for tooltip/popup indicators
    const role = el.getAttribute('role');
    const isTooltipRole = ['tooltip', 'dialog', 'alert', 'menu'].includes(role);
    
    // Check for common tooltip/modal class patterns
    const className = el.className?.toString() || '';
    const isTooltipClass = /tooltip|popup|modal-header|dropdown|popover|hint/i.test(className);
    
    // Z-index check - very high z-index often indicates overlays
    const zIndex = parseInt(style.zIndex) || 0;
    const isOverlay = zIndex > 1000;
    
    // Position check - fixed/absolute positioned small elements are often tooltips
    const position = style.position;
    const isFloating = (position === 'fixed' || position === 'absolute') && height < 100;
    
    // Substantial = has enough text AND isn't a tooltip/overlay
    const hasEnoughText = textLength >= 100;
    const hasSubstantialHeight = height >= 50;
    const isNotTooltip = !isTooltipRole && !isTooltipClass && !isFloating;
    
    return (hasEnoughText || hasSubstantialHeight) && isNotTooltip && !isOverlay;
  }
  
  /**
   * Parent Walker: Climb DOM tree to find substantial container
   * @param {Element} startElement - Starting element
   * @param {number} maxClimbs - Maximum parent levels to climb
   * @returns {Element|null} - Substantial container or null
   */
  function findSubstantialContainer(startElement, maxClimbs = 10) {
    let current = startElement;
    let climbs = 0;
    
    while (current && climbs < maxClimbs) {
      // Check if current element is substantial
      if (isSubstantialElement(current)) {
        const text = current.textContent || '';
        
        // We want at least 300 characters for meaningful context
        if (text.trim().length >= 300) {
          return current;
        }
      }
      
      // Climb to parent
      current = current.parentElement;
      climbs++;
    }
    
    // Fallback: return the best we found or document body section
    return current || document.body;
  }
  
  /**
   * Get surrounding context (3 lines above and below selection)
   * With robust Parent Walker to handle tooltips/modals/decorative elements
   */
  function getSurroundingContext(selection) {
    if (!selection.rangeCount) return null;
    
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    
    // Find the containing block element
    let blockElement = container;
    while (blockElement && blockElement.nodeType !== Node.ELEMENT_NODE) {
      blockElement = blockElement.parentNode;
    }
    
    if (!blockElement) return null;
    
    // ROBUST CONTEXT RETRIEVAL (Z-Index Fix)
    // Check if initial element is too small/decorative
    const initialText = blockElement.textContent || '';
    const style = window.getComputedStyle(blockElement);
    const height = parseFloat(style.height) || blockElement.offsetHeight || 0;
    
    if (height < 50 || initialText.trim().length < 100) {
      // Element is likely a tooltip, modal header, or decorative element
      // Use Parent Walker to find substantial container
      const substantialContainer = findSubstantialContainer(blockElement);
      if (substantialContainer && substantialContainer !== blockElement) {
        console.log('RAL: Parent Walker activated - found substantial container');
        blockElement = substantialContainer;
      }
    }
    
    // Get surrounding text from substantial container
    const fullText = blockElement.textContent || '';
    const selectedText = selection.toString();
    
    const selectedStart = fullText.indexOf(selectedText);
    if (selectedStart === -1) return null;
    
    // Split into lines
    const lines = fullText.split('\n');
    const selectedLines = selectedText.split('\n');
    
    // Find which line the selection starts on
    let charCount = 0;
    let startLineIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= selectedStart) {
        startLineIndex = i;
        break;
      }
      charCount += lines[i].length + 1; // +1 for newline
    }
    
    // Get 3 lines before and after
    const contextStartLine = Math.max(0, startLineIndex - 3);
    const contextEndLine = Math.min(lines.length - 1, startLineIndex + selectedLines.length + 3);
    
    return {
      before: lines.slice(contextStartLine, startLineIndex).join('\n'),
      selected: selectedText,
      after: lines.slice(startLineIndex + selectedLines.length, contextEndLine + 1).join('\n'),
      fullContext: lines.slice(contextStartLine, contextEndLine + 1).join('\n'),
      parentWalkerUsed: height < 50 || initialText.trim().length < 100,
    };
  }
  
  // ============================================================================
  // ENHANCED CODE DETECTION (Structural + Visual)
  // ============================================================================
  
  /**
   * Detect code using structural DOM analysis + CSS inference
   */
  function detectCodeStructural(text, selectionElement) {
    const result = {
      isCode: false,
      language: null,
      confidence: 0,
      codeType: null,
      detectionMethod: 'none',
    };
    
    if (!text || text.length < 10) return result;
    
    // 1. CSS-Inferred Detection
    if (selectionElement) {
      const visualAnalysis = analyzeVisualContext(selectionElement);
      
      if (visualAnalysis) {
        if (visualAnalysis.visualType === 'code' || visualAnalysis.isSyntaxHighlighted) {
          result.isCode = true;
          result.confidence = visualAnalysis.confidence;
          result.detectionMethod = 'visual';
          result.codeType = 'snippet';
        } else if (visualAnalysis.visualType === 'error_message') {
          result.isCode = true;
          result.confidence = visualAnalysis.confidence;
          result.detectionMethod = 'visual_error';
          result.codeType = 'error';
        }
      }
    }
    
    // 2. Structural Detection - check if inside code container
    const codeContainers = identifyCodeContainers();
    for (const container of codeContainers) {
      if (container.element.contains(selectionElement) || 
          container.element === selectionElement) {
        result.isCode = true;
        result.confidence = Math.max(result.confidence, container.confidence);
        result.detectionMethod = 'structural';
        
        if (container.type === 'titled_code_section') {
          result.codeContext = container.title;
        }
      }
    }
    
    // 3. Language detection (still useful)
    if (result.isCode) {
      result.language = detectLanguage(text);
    }
    
    // 4. Fallback to pattern-based detection
    if (!result.isCode) {
      const patternResult = detectCodeByPatterns(text);
      if (patternResult.isCode) {
        result.isCode = true;
        result.language = patternResult.language;
        result.confidence = patternResult.confidence * 0.8; // Lower confidence for pattern-only
        result.codeType = patternResult.codeType;
        result.detectionMethod = 'pattern';
      }
    }
    
    return result;
  }
  
  /**
   * Detect programming language from text
   */
  function detectLanguage(text) {
    const languageSignatures = {
      python: [/^(def|class|import|from)\s/m, /self\./, /:\s*$/m, /__\w+__/],
      javascript: [/^(const|let|var|function)\s/m, /=>/m, /console\./],
      typescript: [/:\s*(string|number|boolean|any)\b/, /interface\s+\w+/, /type\s+\w+\s*=/],
      java: [/^(public|private|protected)\s/m, /System\.out/, /\.java$/],
      cpp: [/#include\s*</, /std::/, /cout\s*<</, /int\s+main\s*\(/],
      rust: [/fn\s+\w+/, /let\s+mut/, /impl\s+/, /pub\s+fn/],
      go: [/^package\s+\w+/m, /func\s+\w+/, /fmt\./],
      sql: [/^(SELECT|INSERT|UPDATE|DELETE)\s/im, /FROM\s+\w+/i],
      shell: [/^\s*\$\s/, /^#!\//, /\|\s*grep/],
    };
    
    let bestLang = null;
    let bestScore = 0;
    
    for (const [lang, patterns] of Object.entries(languageSignatures)) {
      const score = patterns.filter(p => p.test(text)).length;
      if (score > bestScore) {
        bestScore = score;
        bestLang = lang;
      }
    }
    
    return bestLang;
  }
  
  /**
   * Pattern-based code detection (fallback)
   */
  function detectCodeByPatterns(text) {
    const result = { isCode: false, language: null, confidence: 0, codeType: 'snippet' };
    
    const codeIndicators = [
      /[{}\[\]();]/g,
      /[=!<>]=?/g,
      /\b(if|else|for|while|return|function|class|def|const|let|var)\b/g,
      /\/\/|\/\*|\*\/|#.*$/gm,
    ];
    
    let score = 0;
    for (const pattern of codeIndicators) {
      const matches = text.match(pattern);
      if (matches) score += matches.length;
    }
    
    const normalizedScore = score / Math.sqrt(text.length);
    
    if (normalizedScore > 0.5) {
      result.isCode = true;
      result.confidence = Math.min(1, normalizedScore);
      result.language = detectLanguage(text);
      
      // Detect code type
      if (/error|exception|traceback/i.test(text)) {
        result.codeType = 'error';
      } else if (/^(class|struct)\s+\w+/m.test(text)) {
        result.codeType = 'class';
      } else if (/^(def|function|fn)\s+\w+/m.test(text)) {
        result.codeType = 'function';
      }
    }
    
    return result;
  }
  
  // ============================================================================
  // DSA PROBLEM DETECTION (Enhanced)
  // ============================================================================
  
  function detectDSAProblem(text) {
    const result = {
      isDSA: false,
      problemType: null,
      dataStructures: [],
      algorithms: [],
      difficulty: null,
      constraints: [],
      hasExamples: false,
    };
    
    if (!text || text.length < 50) return result;
    
    // Use structural detection for unknown domains
    const platformInfo = detectCompetitivePlatform();
    if (!platformInfo.isPlatform) {
      const contentAnalysis = detectCompetitiveProgrammingByContent();
      if (contentAnalysis.isCompetitiveProgramming) {
        result.isDSA = true;
        result.problemType = 'competitive_programming';
        result.signals = contentAnalysis.signals;
      }
    }
    
    // Data structure detection
    const dsPatterns = {
      'array': /\b(array|list|vector|nums|arr)\b/i,
      'string': /\b(string|substring|palindrome)\b/i,
      'linked list': /\b(linked\s*list|listnode|head|tail)\b/i,
      'tree': /\b(tree|binary\s*tree|bst|treenode|root)\b/i,
      'graph': /\b(graph|vertex|edge|node|adjacent)\b/i,
      'stack': /\b(stack|push|pop)\b/i,
      'queue': /\b(queue|bfs)\b/i,
      'heap': /\b(heap|priority\s*queue)\b/i,
      'hash': /\b(hash|hashmap|dictionary|set)\b/i,
      'matrix': /\b(matrix|grid|2d\s*array)\b/i,
    };
    
    const algoPatterns = {
      'two pointers': /\b(two\s*pointers?|left.*right)\b/i,
      'sliding window': /\b(sliding\s*window|window\s*size)\b/i,
      'binary search': /\b(binary\s*search|sorted|log\s*n)\b/i,
      'dfs': /\b(dfs|depth[\s-]*first|backtrack)\b/i,
      'bfs': /\b(bfs|breadth[\s-]*first|level[\s-]*order)\b/i,
      'dynamic programming': /\b(dp|dynamic\s*programming|memoization)\b/i,
      'greedy': /\b(greedy|optimal)\b/i,
    };
    
    for (const [ds, pattern] of Object.entries(dsPatterns)) {
      if (pattern.test(text)) result.dataStructures.push(ds);
    }
    
    for (const [algo, pattern] of Object.entries(algoPatterns)) {
      if (pattern.test(text)) result.algorithms.push(algo);
    }
    
    // Problem format indicators
    const formatIndicators = [
      /given\s+(an?\s+)?(array|string|linked|tree|graph)/i,
      /return\s+(the|an?)\s+/i,
      /find\s+(the|all|maximum|minimum)/i,
      /example\s*\d*\s*:/i,
      /constraints?\s*:/i,
    ];
    
    const formatScore = formatIndicators.filter(p => p.test(text)).length;
    
    // Constraints extraction
    const constraintMatches = text.match(/\d+\s*<=?\s*\w+\s*<=?\s*\d+/g);
    if (constraintMatches) {
      result.constraints = constraintMatches.slice(0, 5);
    }
    
    result.hasExamples = /example\s*\d*\s*:/i.test(text);
    
    // Final determination
    if (!result.isDSA) {
      result.isDSA = formatScore >= 2 || 
                     result.algorithms.length >= 2 ||
                     (result.dataStructures.length >= 1 && formatScore >= 1);
    }
    
    if (result.isDSA) {
      // Determine problem type
      if (result.algorithms.includes('dynamic programming')) {
        result.problemType = 'dynamic programming';
      } else if (result.algorithms.includes('dfs') || result.algorithms.includes('bfs')) {
        result.problemType = 'graph/tree traversal';
      } else if (result.dataStructures.includes('tree')) {
        result.problemType = 'tree problem';
      } else if (result.dataStructures.includes('graph')) {
        result.problemType = 'graph problem';
      } else {
        result.problemType = result.problemType || 'algorithmic problem';
      }
      
      // Difficulty estimation
      const advancedAlgos = ['dynamic programming', 'union find', 'segment tree'];
      const hasAdvanced = result.algorithms.some(a => advancedAlgos.includes(a));
      
      if (hasAdvanced || result.algorithms.length >= 3) {
        result.difficulty = 'hard';
      } else if (result.algorithms.length >= 2) {
        result.difficulty = 'medium';
      } else {
        result.difficulty = 'easy';
      }
    }
    
    return result;
  }
  
  // ============================================================================
  // COMPETITIVE PLATFORM DETECTION
  // ============================================================================
  
  function detectCompetitivePlatform() {
    const domain = window.location.hostname.toLowerCase();
    
    const platforms = {
      leetcode: domain.includes('leetcode.com'),
      hackerrank: domain.includes('hackerrank.com'),
      codeforces: domain.includes('codeforces.com'),
      codechef: domain.includes('codechef.com'),
      atcoder: domain.includes('atcoder.jp'),
      geeksforgeeks: domain.includes('geeksforgeeks.org'),
      interviewbit: domain.includes('interviewbit.com'),
      topcoder: domain.includes('topcoder.com'),
    };
    
    for (const [platform, match] of Object.entries(platforms)) {
      if (match) {
        return { platform, isPlatform: true };
      }
    }
    
    // Self-correction: check content if domain unknown
    const contentAnalysis = detectCompetitiveProgrammingByContent();
    if (contentAnalysis.isCompetitiveProgramming) {
      return { 
        platform: 'competitive_programming', 
        isPlatform: true,
        detectedByContent: true,
        confidence: contentAnalysis.confidence,
      };
    }
    
    return { platform: null, isPlatform: false };
  }
  
  // ============================================================================
  // CONTEXT COMPRESSION LAYER (Loss-Aware, Adaptive, User-Tailored)
  // ============================================================================

  /**
   * Compress context intelligently without losing semantically critical signals.
   * Strategy:
   * - Preserve high-signal fields verbatim
   * - Summarize low-signal or verbose fields
   * - Adapt compression based on user cognitive state, content type, and source
   * - Always keep reversibility hints (what was dropped vs summarized)
   */
  function compressContext(context) {
    if (!context || typeof context !== 'object') return context;

    const compressionMeta = {
      applied: true,
      timestamp: Date.now(),
      strategy: 'adaptive_loss_aware',
      droppedFields: [],
      summarizedFields: [],
      preservedFields: [],
    };

    // --- 1. Always preserve these critical, low-volume, high-signal fields ---
    const preserved = {
      analysis: context.analysis,
      structured: context.structured,
      topics: context.topics,
      contextPivot: context.contextPivot,
      telemetry: context.telemetry,
      source: context.source,
    };

    compressionMeta.preservedFields.push(
      'analysis',
      'structured',
      'topics',
      'contextPivot',
      'telemetry',
      'source'
    );

    // --- 2. Adaptive text compression ---
    // Heuristic: If text is long AND confidence is high, truncate intelligently.
    let compressedText = context.text;
    if (context.text && context.text.length > 1200) {
      const head = context.text.slice(0, 600);
      const tail = context.text.slice(-300);
      compressedText = `${head}\n…[TRUNCATED ${context.text.length - 900} chars]…\n${tail}`;
      compressionMeta.summarizedFields.push('text');
    } else {
      compressionMeta.preservedFields.push('text');
    }

    // --- 3. Surrounding context compression ---
    let compressedSurrounding = context.surroundingContext;
    if (context.surroundingContext?.fullContext) {
      const fc = context.surroundingContext.fullContext;
      if (fc.length > 800) {
        compressedSurrounding = {
          ...context.surroundingContext,
          fullContext: fc.slice(0, 400) + '\n…[CONTEXT TRUNCATED]…',
          truncated: true,
        };
        compressionMeta.summarizedFields.push('surroundingContext.fullContext');
      } else {
        compressionMeta.preservedFields.push('surroundingContext');
      }
    }

    // --- 4. Global context compression (cross-tab) ---
    let compressedGlobal = context.globalContext;
    if (context.globalContext?.active_research_threads?.length > 3) {
      compressedGlobal = {
        ...context.globalContext,
        active_research_threads: context.globalContext.active_research_threads
          .slice(0, 3)
          .map(t => ({
            domain: t.domain,
            topics: t.topics,
            type: t.type,
            title: t.title,
          })),
        truncated: true,
      };
      compressionMeta.summarizedFields.push('globalContext.active_research_threads');
    } else if (context.globalContext) {
      compressionMeta.preservedFields.push('globalContext');
    }

    // --- 5. Visual context pruning ---
    // Visual context is useful but verbose; keep only signal-bearing attributes
    let compressedVisual = context.visualContext;
    if (context.visualContext) {
      compressedVisual = {
        visualType: context.visualContext.visualType,
        isMonospace: context.visualContext.isMonospace,
        isErrorColored: context.visualContext.isErrorColored,
        confidence: context.visualContext.confidence,
      };
      compressionMeta.summarizedFields.push('visualContext');
    }

    // --- 6. User-state-aware safeguard ---
    // If user is frustrated or in deep study, DO NOT compress aggressively
    if (
      context.telemetry?.cognitiveLoad === 'FRUSTRATED' ||
      context.telemetry?.readingMode === 'deep_study'
    ) {
      compressionMeta.strategy = 'minimal_compression_due_to_cognitive_state';
      return {
        ...context,
        compression: compressionMeta,
      };
    }

    // --- 7. Final compressed object ---
    return {
      ...preserved,
      text: compressedText,
      surroundingContext: compressedSurrounding,
      visualContext: compressedVisual,
      globalContext: compressedGlobal,
      compression: compressionMeta,
    };
  }
  // ============================================================================
  // INTELLIGENT CONTEXT BUILDER
  // ============================================================================
  
  function buildIntelligentContext(text, pageInfo, selectionElement) {
    const dwellTime = calculateDwellTime();
    const surrounding = getSurroundingContext(window.getSelection());
    const topics = extractTopicKeywords(text);
    const pivotInfo = detectContextPivot(topics, pageInfo.domain);

    const evidence = createEvidenceBucket();

    const codeAnalysis = detectCodeStructural(text, selectionElement);
    const dsaAnalysis = detectDSAProblem(text);
    const platformInfo = detectCompetitivePlatform();
    const visualAnalysis = analyzeVisualContext(selectionElement);

    const context = {
      text: text.substring(0, 5000),
      capturedAt: Date.now(),
      source: pageInfo,

      // Telemetry
      telemetry: buildTelemetryPayload(dwellTime),

      // Contextual proximity
      surroundingContext: surrounding,

      // Topic tracking
      topics: topics,
      contextPivot: pivotInfo,

      // Visual analysis
      visualContext: visualAnalysis,

      // Analysis results
      analysis: {
        type: 'text',
        confidence: 0,
        detectionMethod: codeAnalysis.detectionMethod,
      },

      structured: {},
    };

    // DSA Evidence
    if (dsaAnalysis.isDSA) {
      addEvidence(evidence, 'dsa', 'dsa_detector', 0.9);
    }

    // Code Evidence
    if (codeAnalysis.isCode) {
      addEvidence(
        evidence,
        codeAnalysis.codeType === 'error' ? 'error' : 'code',
        codeAnalysis.detectionMethod,
        codeAnalysis.confidence
      );
    }

    // Visual Error Evidence
    if (visualAnalysis?.visualType === 'error_message') {
      addEvidence(evidence, 'error', 'css_visual', visualAnalysis.confidence);
    }

    // Question Evidence
    if (/\?$|^(how|what|why|when|where)\s/im.test(text)) {
      addEvidence(evidence, 'question', 'syntax', 0.4);
    }

    // Final convergence
    const finalInference = resolveFinalInference(evidence);
    context.analysis.type = finalInference.type;
    context.analysis.confidence = finalInference.confidence;
    context.analysis.detectionMethod = finalInference.sources.join('+');

    // Populate structured payload for DSA/code, etc.
    if (dsaAnalysis.isDSA) {
      context.structured = {
        problemType: dsaAnalysis.problemType,
        difficulty: dsaAnalysis.difficulty,
        dataStructures: dsaAnalysis.dataStructures,
        algorithms: dsaAnalysis.algorithms,
        constraints: dsaAnalysis.constraints,
        platform: platformInfo.platform,
      };
    } else if (codeAnalysis.isCode) {
      context.structured = {
        language: codeAnalysis.language,
        codeType: codeAnalysis.codeType,
        codeContext: codeAnalysis.codeContext,
      };
      // Error extraction
      if (codeAnalysis.codeType === 'error') {
        const errorMatch = text.match(/(Error|Exception|TypeError|ValueError)[:\s]+([^\n]+)/i);
        if (errorMatch) {
          context.structured.errorType = errorMatch[1];
          context.structured.errorMessage = errorMatch[2].trim();
        }
      }
    }

    return context;
  }
  
  // ============================================================================
  // SELECTION HANDLERS
  // ============================================================================
  
  function handleSelectionChange() {
    trackSelectionDwell();
    updateActivityTimestamp();
    
    const selection = window.getSelection();
    const selectedText = selection?.toString()?.trim();
    
    if (selectedText && selectedText.length > 0) {
      // v4.0: Track for frustration detection (even if same selection)
      trackUserFrustration('selection', null, selectedText);
      
      if (selectedText !== state.lastSelection) {
        state.lastSelection = selectedText;
        
        // Track selection event in telemetry
        state.telemetry.selectionEvents.push({
          timestamp: Date.now(),
          textLength: selectedText.length,
        });
        
        // Enforce selection events limit
        while (state.telemetry.selectionEvents.length > TELEMETRY_CONFIG.MAX_SELECTION_EVENTS) {
          state.telemetry.selectionEvents.shift();
        }
        
        clearTimeout(state.selectionTimeout);
        state.selectionTimeout = setTimeout(() => {
          const anchorNode = selection.anchorNode;
          const selectionElement = anchorNode?.nodeType === Node.ELEMENT_NODE 
            ? anchorNode 
            : anchorNode?.parentElement;
          
          sendSelectionToBackground(selectedText, 'selection', selectionElement);
        }, 300);
      }
    }
  }
  
  /**
   * Predict next action based on copied content type
   * @param {string} analysisType - The detected content type
   * @param {object} structured - Structured analysis data
   * @param {object} pageInfo - Page information
   * @returns {object} - Clipboard metadata with predicted action
   */
  function buildClipboardMetadata(analysisType, structured, pageInfo) {
    const metadata = {
      predictedNextAction: 'unknown',
      confidence: 0.5,
      environment: null,
      timestamp: Date.now(),
    };
    
    // Shell/terminal commands
    if (analysisType === 'code' && structured?.codeType === 'command') {
      metadata.predictedNextAction = 'terminal_execution';
      metadata.environment = 'terminal';
      metadata.confidence = 0.9;
    }
    // Shell language detected
    else if (structured?.language === 'shell' || structured?.language === 'bash') {
      metadata.predictedNextAction = 'terminal_execution';
      metadata.environment = 'terminal';
      metadata.confidence = 0.85;
    }
    // LeetCode/competitive programming code
    else if (pageInfo?.domain?.includes('leetcode') || 
             pageInfo?.domain?.includes('hackerrank') ||
             pageInfo?.domain?.includes('codeforces')) {
      metadata.predictedNextAction = 'ide_integration';
      metadata.environment = 'code_editor';
      metadata.confidence = 0.85;
      metadata.context = 'competitive_programming';
    }
    // DSA problem code
    else if (analysisType === 'dsa_problem' || structured?.problemType) {
      metadata.predictedNextAction = 'ide_integration';
      metadata.environment = 'code_editor';
      metadata.confidence = 0.8;
      metadata.context = 'algorithm_practice';
    }
    // General code snippets
    else if (analysisType === 'code') {
      // Determine likely destination based on language
      const language = structured?.language;
      
      if (['python', 'javascript', 'typescript', 'java', 'cpp', 'rust', 'go'].includes(language)) {
        metadata.predictedNextAction = 'ide_integration';
        metadata.environment = 'code_editor';
        metadata.confidence = 0.75;
      } else if (['sql'].includes(language)) {
        metadata.predictedNextAction = 'database_client';
        metadata.environment = 'database_tool';
        metadata.confidence = 0.8;
      } else if (['html', 'css'].includes(language)) {
        metadata.predictedNextAction = 'browser_devtools';
        metadata.environment = 'browser';
        metadata.confidence = 0.7;
      } else {
        metadata.predictedNextAction = 'ide_integration';
        metadata.environment = 'code_editor';
        metadata.confidence = 0.6;
      }
    }
    // Error messages - likely to search or paste in AI
    else if (analysisType === 'error_message') {
      metadata.predictedNextAction = 'ai_assistant_query';
      metadata.environment = 'browser';
      metadata.confidence = 0.85;
      metadata.context = 'debugging';
    }
    // GitHub content
    else if (pageInfo?.domain?.includes('github.com')) {
      if (structured?.codeType) {
        metadata.predictedNextAction = 'ide_integration';
        metadata.environment = 'code_editor';
        metadata.confidence = 0.7;
      } else {
        metadata.predictedNextAction = 'documentation_reference';
        metadata.environment = 'note_taking';
        metadata.confidence = 0.6;
      }
    }
    // Stack Overflow content
    else if (pageInfo?.domain?.includes('stackoverflow.com')) {
      metadata.predictedNextAction = 'ide_integration';
      metadata.environment = 'code_editor';
      metadata.confidence = 0.8;
      metadata.context = 'troubleshooting';
    }
    
    return metadata;
  }
  
  function handleCopy(event) {
    const selection = window.getSelection();
    const copiedText = selection?.toString()?.trim();
    
    if (copiedText && copiedText.length > 0) {
      // Update activity timestamp
      updateActivityTimestamp();
      
      const anchorNode = selection.anchorNode;
      const selectionElement = anchorNode?.nodeType === Node.ELEMENT_NODE 
        ? anchorNode 
        : anchorNode?.parentElement;
      
      // Track copy event in telemetry
      state.telemetry.copyEvents.push({
        timestamp: Date.now(),
        textLength: copiedText.length,
      });
      
      // Enforce copy events limit
      while (state.telemetry.copyEvents.length > TELEMETRY_CONFIG.MAX_COPY_EVENTS) {
        state.telemetry.copyEvents.shift();
      }
      
      sendSelectionToBackground(copiedText, 'copy', selectionElement);
    }
  }
  
  function sendSelectionToBackground(text, type, selectionElement) {
    if (!chrome.runtime?.id) return;

    // Update activity timestamp on any selection/copy
    updateActivityTimestamp();

    // v4.0: PRIVACY SCRUBBING - Mask sensitive data before processing
    const maskedText = maskSensitiveData(text);
    const hadSensitiveData = maskedText !== text;

    const pageInfo = {
      url: window.location.href,
      domain: window.location.hostname,
      title: document.title,
      path: window.location.pathname,
    };

    const intelligentContext = buildIntelligentContext(maskedText, pageInfo, selectionElement);
    // v4.2: Context Compression (Loss-Aware)
    const compressedContext = compressContext(intelligentContext);
    const platformInfo = detectCompetitivePlatform();
    const pageType = detectPageType(pageInfo);

    // v4.0: Broadcast to other tabs (Unified Reality)
    broadcastToUnifiedReality(
      intelligentContext.topics,
      intelligentContext.analysis.type,
      pageInfo
    );

    // Build payload
    const payload = {
      text: maskedText.substring(0, 5000),
      captureType: type,
      timestamp: Date.now(),
      source: pageInfo,
      pageType: platformInfo.isPlatform ? platformInfo.platform : pageType,

      // Intelligent analysis (compressed context)
      analysis: compressedContext.analysis,
      structured: compressedContext.structured,

      // Advanced features
      telemetry: compressedContext.telemetry,
      surroundingContext: compressedContext.surroundingContext,
      visualContext: compressedContext.visualContext,
      topics: compressedContext.topics,
      contextPivot: compressedContext.contextPivot,

      // v4.0: Global Context (Cross-Tab Unified Reality)
      globalContext: compressedContext.globalContext,
      compression: compressedContext.compression,

      // v4.0: Privacy metadata
      privacy: {
        sensitive_data_masked: hadSensitiveData,
        scrubbing_applied: hadSensitiveData,
      },
    };
    
    // v4.0: Add frustration state if active
    if (state.frustration.isCurrentlyFrustrated) {
      payload.behavioral_state = {
        frustration_detected: true,
        cognitive_load: 'FRUSTRATED',
        llm_hint: 'User appears frustrated - be extra helpful and concise',
      };
    }
    
    // COPY-INTENT: Add clipboard metadata for copy events with code/shell
    if (type === 'copy') {
      const analysisType = intelligentContext.analysis.type;
      
      // Add clipboard metadata for code, shell, and DSA content
      if (['code', 'dsa_problem', 'error_message'].includes(analysisType) ||
          intelligentContext.structured?.language === 'shell' ||
          intelligentContext.structured?.codeType === 'command') {
        
        payload.clipboard_metadata = buildClipboardMetadata(
          analysisType,
          intelligentContext.structured,
          pageInfo
        );
        
        console.log('RAL v4.0: Clipboard metadata added -', 
                    'Predicted action:', payload.clipboard_metadata.predictedNextAction,
                    '| Confidence:', payload.clipboard_metadata.confidence);
      }
    }
    
    try {
      chrome.runtime.sendMessage({
        type: 'SELECTION_CAPTURED',
        payload: payload
      });
      
      const globalThreads = state.globalContext.active_research_threads.length;
      console.log('RAL v4.0: Captured', type, 
                  '| Type:', intelligentContext.analysis.type,
                  '| Cognitive:', intelligentContext.telemetry.cognitiveLoad,
                  '| Global Threads:', globalThreads,
                  hadSensitiveData ? '| 🔒 PII Masked' : '');
    } catch (e) {
      // Extension context may be invalidated
    }
  }
  
  function detectPageType(pageInfo) {
    const domain = pageInfo.domain.toLowerCase();
    const path = pageInfo.path.toLowerCase();
    
    if (domain.includes('github.com')) {
      if (path.includes('/issues/')) return 'github-issue';
      if (path.includes('/pull/')) return 'github-pr';
      if (path.includes('/blob/')) return 'github-code';
      return 'github';
    }
    if (domain.includes('stackoverflow.com')) return 'stackoverflow';
    if (domain.includes('docs.') || path.includes('/docs/')) return 'documentation';
    if (domain.includes('medium.com') || domain.includes('dev.to')) return 'article';
    
    return 'webpage';
  }
  
  // ============================================================================
  // PAGE CONTENT EXTRACTION (Enhanced with Shadow DOM)
  // ============================================================================
  
  function extractPageContent() {
    const domain = window.location.hostname;
    const platformInfo = detectCompetitivePlatform();
    
    // Use deep query for Shadow DOM support
    if (platformInfo.platform === 'leetcode') {
      return extractLeetCodeContent();
    }
    
    if (domain.includes('github.com')) {
      return extractGitHubContent();
    }
    
    if (domain.includes('stackoverflow.com')) {
      return extractStackOverflowContent();
    }
    
    return extractGenericContent();
  }
  
  function extractLeetCodeContent() {
    const content = { type: 'leetcode' };
    
    // Use Shadow DOM aware queries
    const titleEl = deepQuerySelector(document, '[data-cy="question-title"], .text-title-large');
    if (titleEl) {
      const titleMatch = titleEl.textContent?.match(/(\d+)\.\s*(.+)/);
      if (titleMatch) {
        content.problemNumber = titleMatch[1];
        content.problemTitle = titleMatch[2].trim();
      }
    }
    
    const diffEl = deepQuerySelector(document, '[class*="difficulty"]');
    if (diffEl) {
      const diffText = diffEl.textContent?.toLowerCase() || '';
      if (diffText.includes('easy')) content.difficulty = 'Easy';
      else if (diffText.includes('medium')) content.difficulty = 'Medium';
      else if (diffText.includes('hard')) content.difficulty = 'Hard';
    }
    
    const descEl = deepQuerySelector(document, '[data-track-load="description_content"], .elfjS');
    if (descEl) {
      content.description = descEl.textContent?.trim().substring(0, 3000);
    }
    
    return content;
  }
  
  function extractGitHubContent() {
    const path = window.location.pathname;
    const content = {
      type: 'github',
      repo: path.split('/').slice(1, 3).join('/'),
    };
    
    if (path.includes('/issues/')) {
      content.type = 'github-issue';
      content.issueTitle = deepQuerySelector(document, '.js-issue-title')?.textContent?.trim();
      content.issueBody = deepQuerySelector(document, '.js-comment-body')?.textContent?.trim().substring(0, 2000);
    }
    
    if (path.includes('/pull/')) {
      content.type = 'github-pr';
      content.prTitle = deepQuerySelector(document, '.js-issue-title')?.textContent?.trim();
    }
    
    return content;
  }
  
  function extractStackOverflowContent() {
    return {
      type: 'stackoverflow',
      questionTitle: deepQuerySelector(document, '.question-hyperlink')?.textContent?.trim(),
      question: deepQuerySelector(document, '.question .js-post-body')?.textContent?.trim().substring(0, 2000),
      tags: [...deepQuerySelectorAll(document, '.post-tag')].map(t => t.textContent?.trim()),
    };
  }
  
  function extractGenericContent() {
    const title = document.title;
    const h1 = deepQuerySelector(document, 'h1')?.textContent?.trim();
    
    return {
      type: 'webpage',
      title,
      heading: h1,
      codeContainers: identifyCodeContainers().length,
      isCompetitiveProgramming: detectCompetitiveProgrammingByContent().isCompetitiveProgramming,
    };
  }
  
  // ============================================================================
  // MESSAGE HANDLERS
  // ============================================================================
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_PAGE_CONTENT') {
      sendResponse(extractPageContent());
      return true;
    }
    
    if (message.type === 'GET_CURRENT_SELECTION') {
      const selection = window.getSelection();
      const selectedText = selection?.toString()?.trim();
      
      if (selectedText) {
        const pageInfo = {
          url: window.location.href,
          domain: window.location.hostname,
          title: document.title,
          path: window.location.pathname,
        };
        const anchorNode = selection.anchorNode;
        const selectionElement = anchorNode?.nodeType === Node.ELEMENT_NODE 
          ? anchorNode 
          : anchorNode?.parentElement;
        
        const ctx = buildIntelligentContext(selectedText, pageInfo, selectionElement);
        sendResponse({
          selection: selectedText,
          analysis: ctx.analysis,
          structured: ctx.structured,
          telemetry: ctx.telemetry,
        });
      } else {
        sendResponse({ selection: null });
      }
      return true;
    }
    
    if (message.type === 'GET_TELEMETRY') {
      sendResponse(state.telemetry);
      return true;
    }
  });
  
  // ============================================================================
  // INITIALIZE
  // ============================================================================
  
  document.addEventListener('selectionchange', handleSelectionChange);
  document.addEventListener('copy', handleCopy);
  document.addEventListener('mouseup', () => setTimeout(handleSelectionChange, 50));
  
  console.log('RAL v4.0: Extreme Intelligence Engine active on', window.location.hostname);
  console.log('Structural: DOM Topology, Telemetry, CSS Analysis, Shadow DOM, Context Pivot');
  console.log('Extreme: Frustration Detection, Cross-Tab Fusion, Hardware-Aware, Privacy Scrubbing');
})();
