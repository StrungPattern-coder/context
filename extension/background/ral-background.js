/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *                    RAL CORTEX - Neural Background Service v3.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * The central nervous system for the Reality Anchoring Layer.
 * This module acts as the "Neural Backend" - managing cross-tab state so the
 * Reality Arbiter in ral-core.js can make intelligent context decisions.
 * 
 * v3.0 Capabilities:
 * 
 * 1. GLOBAL REALITY MAPPING    - Cross-tab context synchronization
 * 2. REALITY DECAY ENGINE      - Automatic cleanup of stale contexts (anti-hallucination)
 * 3. NEURAL INTENT SYNTHESIS   - Heuristic-based user intent & frustration detection
 * 4. CONTEXT FABRICATION       - Generates XML/Prompt injection payloads
 * 5. TELEMETRY AGGREGATION     - System-wide health and usage tracking
 * 
 * @version 3.0.0
 */

'use strict';

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const RAL_CORTEX_VERSION = '3.0.0';
const REALITY_DECAY_INTERVAL = 60000;       // Check for stale contexts every 1 minute
const REALITY_DECAY_THRESHOLD = 10 * 60 * 1000;  // Contexts older than 10 minutes decay
const MAX_ERROR_LOG_SIZE = 50;
const MAX_SELECTION_HISTORY = 10;

// ============================================================================
// GLOBAL STATE
// ============================================================================

/**
 * The Global Reality Map - The Brain's memory of all active tabs
 * Key: TabID (string)
 * Value: { context, fullContext, timestamp, interactionCount, isActive, threadId }
 */
let globalRealityMap = {};

/**
 * Selection History - Recent clipboard/selection events
 */
let selectionHistory = [];

/**
 * User Settings (persisted to chrome.storage)
 */
let userSettings = {
  enabled: true,
  ghostMode: false,           // Global Ghost Scrubber toggle
  neuralThrottling: true,     // Hardware-aware throttling toggle
  stealthMode: false,         // Hide all RAL UI indicators
  theme: 'deep-space-glass',  // UI theme preference
  userProfile: {
    role: 'Developer',
    expertise: 'High',
    focus: 'AI/Neural Architectures',
    location: 'Pune, IN'
  }
};

/**
 * Telemetry Store - Tracks extension health and usage
 */
let telemetry = {
  totalInjections: 0,
  frustrationEvents: 0,
  realitySyncs: 0,
  decayedContexts: 0,
  startTime: Date.now(),
  errors: []
};

// ============================================================================
// LIFECYCLE MANAGEMENT
// ============================================================================

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`RAL Cortex v${RAL_CORTEX_VERSION}: Neural Link Established (${details.reason})`);
  
  // Initialize storage with defaults on fresh install
  chrome.storage.local.get(['ral_settings'], (result) => {
    if (!result.ral_settings) {
      chrome.storage.local.set({ ral_settings: userSettings });
      console.log('RAL Cortex: Default settings initialized');
    } else {
      userSettings = { ...userSettings, ...result.ral_settings };
      console.log('RAL Cortex: Settings loaded from storage');
    }
  });
});

// Tab closed cleanup - Remove reality when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  const threadId = tabId.toString();
  if (globalRealityMap[threadId]) {
    delete globalRealityMap[threadId];
    console.log(`RAL Cortex: Cleaned reality for closed tab ${threadId}`);
  }
});

// ============================================================================
// REALITY DECAY ENGINE
// ============================================================================

/**
 * Reality Decay Loop - Prevents "hallucinations" from stale contexts
 * Runs every minute to clean up contexts that haven't been touched
 */
setInterval(() => {
  const now = Date.now();
  let decayedCount = 0;
  
  for (const [threadId, reality] of Object.entries(globalRealityMap)) {
    if (now - reality.timestamp > REALITY_DECAY_THRESHOLD) {
      delete globalRealityMap[threadId];
      decayedCount++;
    }
  }
  
  if (decayedCount > 0) {
    telemetry.decayedContexts += decayedCount;
    console.log(`RAL Entropy: Decayed ${decayedCount} stale reality context(s). Total decayed: ${telemetry.decayedContexts}`);
  }
}, REALITY_DECAY_INTERVAL);

// ============================================================================
// MESSAGE ROUTING (THE NERVOUS SYSTEM)
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Identify the sender thread
  const threadId = sender.tab ? sender.tab.id.toString() : 'system';
  const tabInfo = sender.tab || null;
  
  // Async handler wrapper
  const handleAsync = async () => {
    try {
      switch (request.type) {
        
        case 'GET_SETTINGS':
          return userSettings;

        case 'UPDATE_SETTINGS':
          if (request.payload) {
            userSettings = { ...userSettings, ...request.payload };
            await chrome.storage.local.set({ ral_settings: userSettings });
          }
          return { success: true, settings: userSettings };

        case 'GET_GLOBAL_REALITY':
          // Reality Arbiter requesting the full map
          updateRealityHeartbeat(threadId);
          telemetry.realitySyncs++;
          return { 
            globalRealityMap: prepareRealityMapForArbiter(threadId)
          };

        case 'UPDATE_REALITY':
          // Core pushing its local state to the global map
          updateRealityState(threadId, request.payload);
          return { success: true };

        case 'GET_CONTEXT':
          // The heavy lifting: Context Synthesis
          const context = await synthesizeContext(threadId, tabInfo, request.platform, request.prompt);
          // Update the Global Map with this fresh interaction
          updateRealityFromSynthesis(threadId, context);
          return context;

        case 'GET_TELEMETRY':
          return {
            ...telemetry,
            uptime: Date.now() - telemetry.startTime,
            activeRealities: Object.keys(globalRealityMap).length,
            selectionCount: selectionHistory.length
          };

        case 'UPDATE_STATE':
          // Partial state update from Core (e.g., frustration detected)
          if (globalRealityMap[threadId] && request.payload) {
            if (request.payload.frustrationLevel) {
              globalRealityMap[threadId].context.frustrationLevel = request.payload.frustrationLevel;
              if (request.payload.frustrationLevel === 'HIGH') {
                telemetry.frustrationEvents++;
              }
            }
          }
          return { status: 'ack' };

        // ─── Selection Tracking (from selection-tracker.js) ───
        case 'SELECTION_UPDATE':
          trackSelection(request.selection, threadId, tabInfo);
          return { ack: true };

        case 'GET_SELECTIONS':
          return { selections: selectionHistory };

        case 'CLEAR_SELECTIONS':
          selectionHistory = [];
          return { success: true };

        case 'LOG_ERROR':
          logError(request.error, threadId);
          return { ack: true };

        case 'PING':
          return { pong: true, version: RAL_CORTEX_VERSION };

        default:
          console.warn(`RAL Cortex: Unknown signal type: ${request.type}`);
          return null;
      }
    } catch (error) {
      console.error('RAL Cortex: Critical failure in message handler:', error);
      logError(error, threadId);
      return { _extensionError: true, message: error.message };
    }
  };

  // Execute and keep channel open for async response
  handleAsync().then(sendResponse);
  return true; 
});

// ============================================================================
// REALITY MANAGEMENT ENGINE
// ============================================================================

/**
 * Updates the heartbeat timestamp for a thread
 * Called when a tab requests the reality map (proves it's still alive)
 */
function updateRealityHeartbeat(threadId) {
  if (globalRealityMap[threadId]) {
    globalRealityMap[threadId].timestamp = Date.now();
    globalRealityMap[threadId].isActive = true;
  }
}

/**
 * Full state update from Core
 */
function updateRealityState(threadId, payload) {
  if (!payload) return;
  
  globalRealityMap[threadId] = {
    ...globalRealityMap[threadId],
    ...payload,
    timestamp: Date.now(),
    isActive: true,
    threadId: threadId,
    interactionCount: (globalRealityMap[threadId]?.interactionCount || 0) + 1
  };
}

/**
 * Updates reality map after context synthesis
 */
function updateRealityFromSynthesis(threadId, contextData) {
  globalRealityMap[threadId] = {
    context: contextData.synthesis,           // Lighter version for scoring
    fullContext: contextData.context,         // Full context for deep inspection
    timestamp: Date.now(),
    interactionCount: (globalRealityMap[threadId]?.interactionCount || 0) + 1,
    isActive: true,
    threadId: threadId
  };
}

/**
 * Prepares the reality map for the Arbiter
 * - Marks the requesting thread as "active"
 * - Marks others as inactive (for scoring purposes)
 */
function prepareRealityMapForArbiter(requestingThreadId) {
  const preparedMap = {};
  
  for (const [threadId, reality] of Object.entries(globalRealityMap)) {
    preparedMap[threadId] = {
      ...reality,
      isActive: (threadId === requestingThreadId)
    };
  }
  
  return preparedMap;
}

// ============================================================================
// CONTEXT SYNTHESIZER (NEURAL FABRICATION)
// ============================================================================

/**
 * Synthesizes the "Reality Context" for injection
 * This generates the payload that ral-core.js v3.0 expects
 */
async function synthesizeContext(threadId, tabInfo, platform, userPrompt) {
  const tabTitle = tabInfo?.title || 'Unknown Tab';
  const tabUrl = tabInfo?.url || '';
  
  // 1. Neural Heuristic Analysis
  const analysis = analyzeIntent(userPrompt || '', tabTitle, tabUrl);
  
  // 2. Scan Cross-Tab Context (What is user doing elsewhere?)
  const crossTabData = gatherCrossTabContext(threadId);
  
  // 3. Build the Behavioral State
  const behavioralState = {
    userIntent: analysis.intent,
    frustrationLevel: analysis.frustration,
    primaryLanguage: detectPrimaryLanguage(userPrompt, tabTitle),
    readingMode: analysis.mode,
    cognitiveLoad: analysis.cognitiveLoad,
    timestamp: Date.now()
  };

  // 4. Get recent selections for context enrichment
  const recentSelections = getRecentSelections(3);

  // 5. Construct the XML Injection Payload
  const contextXml = buildContextXml({
    platform,
    tabTitle,
    behavioralState,
    crossTabData,
    analysis,
    userProfile: userSettings.userProfile,
    recentSelections
  });

  // 6. Build the synthesis summary (for UI and Arbiter scoring)
  const synthesis = {
    confidence: analysis.confidence,
    userIntent: behavioralState.userIntent,
    frustrationLevel: behavioralState.frustrationLevel,
    primaryLanguage: behavioralState.primaryLanguage,
    topics: analysis.topics,
    summary: `${analysis.intentDescription} in ${tabTitle}`
  };

  // 7. Update telemetry
  telemetry.totalInjections++;

  // 8. Return the full context object
  return {
    enabled: userSettings.enabled,
    
    // Flat string fallback for simple injection
    contextString: `User is ${analysis.intentDescription}. Focus: ${tabTitle}. ${behavioralState.frustrationLevel === 'HIGH' ? '⚠️ FRUSTRATION DETECTED' : ''}`,
    
    // Rich data object for RAL Core v3.0
    context: {
      selection: {
        telemetry: {
          readingMode: behavioralState.readingMode,
          cognitiveLoad: behavioralState.cognitiveLoad
        },
        recent: recentSelections
      },
      xml: contextXml,
      system_telemetry: await gatherSystemTelemetry()
    },
    
    // Synthesis summary for UI and Arbiter
    synthesis,
    
    // Pre-formatted injection text
    injection: {
      formatted: `<reality_context version="3.0">\n${contextXml}\n</reality_context>\n\n`
    }
  };
}

/**
 * Builds the XML context payload
 */
function buildContextXml({ platform, tabTitle, behavioralState, crossTabData, analysis, userProfile, recentSelections }) {
  const timestamp = new Date().toISOString();
  const localTime = new Date().toLocaleTimeString();
  
  // Build cross-tab references
  let crossTabXml = '';
  if (crossTabData.references.length > 0) {
    crossTabXml = `
  <active_research>
    ${crossTabData.references.map(ref => `<tab title="${escapeXml(ref.title)}">${escapeXml(ref.summary)}</tab>`).join('\n    ')}
  </active_research>`;
  }

  // Build recent selections context
  let selectionsXml = '';
  if (recentSelections && recentSelections.length > 0) {
    selectionsXml = `
  <recent_selections>
    ${recentSelections.map(sel => `<selection source="${escapeXml(sel.title)}" type="${sel.type}">${escapeXml(sel.text.substring(0, 500))}</selection>`).join('\n    ')}
  </recent_selections>`;
  }

  return `
<meta>
  <timestamp>${timestamp}</timestamp>
  <platform>${platform || 'generic'}</platform>
  <focus>${escapeXml(userProfile.focus)}</focus>
  <expertise>${userProfile.expertise}</expertise>
</meta>

<user_state>
  <intent>${behavioralState.userIntent}</intent>
  <cognitive_load>${behavioralState.cognitiveLoad}</cognitive_load>
  <frustration>${behavioralState.frustrationLevel}</frustration>
  <current_task>${escapeXml(tabTitle)}</current_task>
  <primary_language>${behavioralState.primaryLanguage}</primary_language>
</user_state>

<environment>
  <time>${localTime}</time>
  <location>${userProfile.location}</location>
  <active_topics>${analysis.topics.join(', ')}</active_topics>
</environment>
${crossTabXml}${selectionsXml}
<system_instruction>
  User is currently focused on ${behavioralState.userIntent}. 
  ${behavioralState.frustrationLevel === 'HIGH' 
    ? '⚠️ FRUSTRATION DETECTED: Be concise, direct, and solution-oriented. Skip pleasantries.' 
    : 'Maintain a helpful, technical persona.'}
</system_instruction>
`.trim();
}

// ============================================================================
// NEURAL HEURISTICS ENGINE
// ============================================================================

/**
 * Analyzes text to determine intent, frustration, and context
 */
function analyzeIntent(prompt, title, url) {
  const combined = (prompt + ' ' + title + ' ' + url).toLowerCase();
  
  let intent = 'GENERAL_QUERY';
  let frustration = 'NORMAL';
  let cognitiveLoad = 'NORMAL';
  let intentDescription = 'browsing';
  let mode = 'casual';
  let confidence = 'MEDIUM';
  const topics = new Set(['general']);

  // ─── Coding / Development ───
  if (combined.match(/code|function|api|class|method|variable|const|let|import|export|debug|compile|build|deploy/)) {
    intent = 'CODING';
    intentDescription = 'writing or reviewing code';
    mode = 'focus';
    confidence = 'HIGH';
    topics.add('coding');
  }
  
  // ─── Algorithms / Data Structures ───
  if (combined.match(/bfs|dfs|algorithm|sort|search|tree|graph|queue|stack|hash|linked list|binary/)) {
    intent = 'CODING';
    intentDescription = 'implementing algorithms';
    mode = 'deep-focus';
    confidence = 'HIGH';
    topics.add('algorithms');
    topics.add('data-structures');
  }
  
  // ─── Debugging / Troubleshooting ───
  if (combined.match(/error|exception|fail|fix|bug|issue|problem|broken|crash|undefined|null|nan/)) {
    intent = 'DEBUGGING';
    intentDescription = 'troubleshooting code';
    mode = 'problem-solving';
    cognitiveLoad = 'HIGH';
    confidence = 'HIGH';
    topics.add('debugging');
  }
  
  // ─── Writing / Documentation ───
  if (combined.match(/write|draft|email|essay|document|readme|comment|explain/)) {
    intent = 'WRITING';
    intentDescription = 'writing or documenting';
    mode = 'creative';
    topics.add('writing');
  }
  
  // ─── Research / Learning ───
  if (combined.match(/what is|how to|why does|research|learn|study|tutorial|guide|docs|documentation/)) {
    intent = 'RESEARCH';
    intentDescription = 'researching and learning';
    mode = 'discovery';
    topics.add('research');
  }
  
  // ─── Academic / College ───
  if (combined.match(/college|university|pict|syllabus|exam|assignment|semester|course|professor/)) {
    intent = 'ACADEMIC';
    intentDescription = 'working on academic content';
    mode = 'focus';
    topics.add('academic');
  }

  // ─── AI / Neural Networks ───
  if (combined.match(/ai|neural|machine learning|ml|deep learning|model|training|inference|tensor|pytorch|tensorflow/)) {
    topics.add('ai');
    topics.add('neural-networks');
  }

  // ─── Frustration Detection ───
  const frustrationSignals = [
    /!{2,}/,                    // Multiple exclamation marks
    /\?{2,}/,                   // Multiple question marks
    /stupid|dumb|hate|annoying/,
    /again|still|why won't|doesn't work/,
    /help me|please|desperate/,
    /wtf|wth|omg/i
  ];
  
  const frustrationScore = frustrationSignals.reduce((score, pattern) => {
    return score + (combined.match(pattern) ? 1 : 0);
  }, 0);
  
  if (frustrationScore >= 2) {
    frustration = 'HIGH';
    cognitiveLoad = 'OVERLOADED';
  } else if (frustrationScore === 1) {
    frustration = 'ELEVATED';
    cognitiveLoad = 'HIGH';
  }

  return {
    intent,
    frustration,
    cognitiveLoad,
    intentDescription,
    mode,
    confidence,
    topics: Array.from(topics)
  };
}

/**
 * Detects the primary programming language from context
 */
function detectPrimaryLanguage(prompt, title) {
  const combined = (prompt + ' ' + title).toLowerCase();
  
  const languagePatterns = {
    'python': /python|\.py|pip|pandas|numpy|pytorch|tensorflow|django|flask/,
    'javascript': /javascript|\.js|node|npm|react|vue|angular|typescript|\.ts/,
    'java': /\bjava\b|\.java|spring|maven|gradle/,
    'c++': /c\+\+|cpp|\.cpp|\.h/,
    'rust': /\brust\b|cargo|\.rs/,
    'go': /\bgolang\b|\.go\b/,
    'sql': /\bsql\b|mysql|postgres|database|query/,
  };
  
  for (const [lang, pattern] of Object.entries(languagePatterns)) {
    if (combined.match(pattern)) {
      return lang;
    }
  }
  
  return 'unknown';
}

/**
 * Gathers context from other active tabs
 */
function gatherCrossTabContext(currentThreadId) {
  const references = [];
  const allTopics = new Set();
  
  for (const [threadId, reality] of Object.entries(globalRealityMap)) {
    if (threadId === currentThreadId) continue;
    
    if (reality.context) {
      // Add topics
      if (reality.context.topics) {
        reality.context.topics.forEach(t => allTopics.add(t));
      }
      
      // Add reference
      references.push({
        threadId,
        title: reality.context.summary?.split(' in ')[1] || `Tab ${threadId}`,
        summary: reality.context.userIntent || 'Active context'
      });
    }
  }
  
  return {
    references: references.slice(0, 5), // Limit to 5 cross-tab references
    topics: Array.from(allTopics)
  };
}

// ============================================================================
// HARDWARE TELEMETRY
// ============================================================================

/**
 * Gathers system telemetry for hardware-aware throttling
 * Note: Service Workers have limited access to system APIs
 */
async function gatherSystemTelemetry() {
  return {
    status: 'nominal',
    timestamp: Date.now(),
    // These would be populated by content script in ral-core.js
    // We provide baseline/placeholder for the Core to compare against
    memoryPressure: 'normal',
    connectionType: 'unknown'
  };
}

// ============================================================================
// SELECTION TRACKING
// ============================================================================

/**
 * Tracks user selections and clipboard activity
 */
function trackSelection(selection, threadId, tabInfo) {
  if (!selection || !selection.text || selection.text.trim().length < 3) {
    return;
  }
  
  const entry = {
    text: selection.text.substring(0, 2000), // Limit size
    type: selection.type || 'selection',
    source: tabInfo?.url || 'unknown',
    title: tabInfo?.title || 'Unknown',
    threadId,
    timestamp: Date.now()
  };
  
  // Avoid duplicates (same text within last 5 seconds)
  const isDuplicate = selectionHistory.some(h => 
    h.text === entry.text && 
    (Date.now() - h.timestamp) < 5000
  );
  
  if (!isDuplicate) {
    selectionHistory.unshift(entry);
    
    // Keep history bounded
    if (selectionHistory.length > MAX_SELECTION_HISTORY) {
      selectionHistory.pop();
    }
    
    console.log(`RAL Cortex: Tracked ${entry.type} (${entry.text.length} chars) from ${entry.title}`);
  }
}

/**
 * Gets recent selections for context synthesis
 */
function getRecentSelections(limit = 3) {
  return selectionHistory.slice(0, limit);
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Escapes XML special characters
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Logs errors to telemetry
 */
function logError(error, threadId = 'unknown') {
  const errorEntry = {
    timestamp: Date.now(),
    threadId,
    message: error?.message || String(error),
    stack: error?.stack
  };
  
  telemetry.errors.push(errorEntry);
  
  // Keep error log bounded
  if (telemetry.errors.length > MAX_ERROR_LOG_SIZE) {
    telemetry.errors.shift();
  }
  
  console.error('RAL Cortex Error:', errorEntry);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║       RAL CORTEX v${RAL_CORTEX_VERSION} - Neural Backend Online              ║
║                                                               ║
║  • Global Reality Mapping:  ACTIVE                            ║
║  • Reality Decay Engine:    ACTIVE (${REALITY_DECAY_THRESHOLD / 60000}min threshold)           ║
║  • Neural Intent Analysis:  ACTIVE                            ║
║  • Telemetry Aggregation:   ACTIVE                            ║
╚═══════════════════════════════════════════════════════════════╝
`);
