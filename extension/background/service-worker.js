/**
 * RAL Browser Extension - Background Service Worker
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 *                    EXTREME INTELLIGENCE ENGINE v3.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * DEEP CONTEXT ARCHITECTURE:
 * - Clipboard & Selection tracking across ALL browser pages
 * - Persistent memory & user profile
 * - Active page content extraction
 * - Browser intelligence (tabs, history, focus detection)
 * 
 * EXTREME INTELLIGENCE MODULES:
 * 1. Context Fusion Engine      - synthesizeActiveReality with Relevance Scoring
 * 2. Dynamic Profile Evolution  - Auto-learning tech stack from behavior
 * 3. Behavioral LLM Directives  - Cognitive-aware system instructions
 * 4. Adaptive Injection Formats - Multimodal XML Context Wrapper
 * 5. Cross-Tab Truth Arbiter    - Global Reality Map with conflict resolution
 * 6. Reality Decay Engine       - v3.0: Auto-cleanup of stale contexts
 * 7. Neural Intent Synthesis    - v3.0: Enhanced heuristic-based detection
 * 
 * This provides context that LLMs CANNOT know:
 * - What user just copied/selected
 * - What they're working on  
 * - Their preferences and tech stack
 * - The actual content of pages they're viewing
 * - Their cognitive and frustration state
 * - Cross-tab unified research context
 */

const RAL_VERSION = '3.0.0';

// v3.0: Reality Decay Configuration
const REALITY_DECAY_INTERVAL = 60000;           // Check every 1 minute
const REALITY_DECAY_THRESHOLD = 10 * 60 * 1000; // 10 minutes for tab contexts
const RESEARCH_DECAY_THRESHOLD = 30 * 60 * 1000; // 30 minutes for research threads

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  mode: 'local', // 'local' | 'server' | 'hybrid'
  
  // Basic Context (temporal)
  includeTimezone: true,
  includeDate: true,
  includeTime: true,
  includeDayPart: true,
  includeWeekend: true,
  
  // Deep Context (browser intelligence)
  includeBrowserTabs: true,      // What tabs are open
  includeRecentActivity: true,   // Recent browsing history
  includeCurrentFocus: true,     // What category user is focused on
  includeRelevantTabs: true,     // Titles of non-AI tabs
  
  // KILLER FEATURES
  includeClipboard: true,        // Recent clipboard/selections
  includePageContent: true,      // Active page context
  includeUserProfile: true,      // Persistent memory
  
  // v4.0+ NEW CONTEXT FEATURES
  includeSonicBridge: true,      // "The Sonic Bridge" - YouTube/Meet captions
  includeRichTabContext: true,   // "Rich Tab Context" - Active resources
  includeHistorySummary: true,   // "Temporal Context" - History summary
  
  // Future Context
  includeLocation: false,
  includeWeather: false,
  includeCalendar: false,
  
  // Server configuration
  serverUrl: null,
  apiKey: null,
  userId: null,
  
  // Advanced options
  autoDetect: false, // Always inject context
  maxContextTokens: 1000,
  cacheTimeout: 15000, // 15 second cache for fresher context
  
  // Stats
  promptsEnhanced: 0,
  lastUsed: null,
};

// ============================================================================
// SELECTION & CLIPBOARD STORAGE
// ============================================================================

// Store recent selections/copies (in-memory, persisted to storage)
let selectionHistory = [];
const MAX_SELECTIONS = 10;

// User profile (persistent memory)
let userProfile = {
  techStack: [],
  preferences: [],
  currentProject: null,
  recentTopics: [],
  customContext: '',
  // v4.6 Task Context (HIGH VALUE - per ChatGPT feedback)
  taskContext: {
    goal: '',           // What are you trying to achieve?
    currentStep: '',    // What step are you on now?
    successCriteria: '',// How will you know it's done?
    nonGoals: '',       // What are you NOT trying to do?
  },
};

// Context cache
let contextCache = {
  data: null,
  serverData: null,
  timestamp: 0,
};

// ============================================================================
// CROSS-TAB TRUTH ARBITER - Global Reality Map
// ============================================================================

/**
 * Global Reality Map: Unified cross-tab context state
 * Resolves conflicts when multiple tabs report different contexts
 * 
 * v3.0 Enhancement: Now supports Reality Arbiter in ral-core.js
 * - Each tab entry includes interactionScore for arbiter scoring
 * - Reality Decay Engine automatically cleans stale contexts
 * - prepareRealityMapForArbiter() marks active/inactive states
 */
let globalRealityMap = {
  activeTabs: new Map(),  // tabId -> { domain, language, topics, telemetry, lastUpdate, interactionScore }
  primaryContext: null,    // The "truth" - highest telemetry confidence wins
  researchThreads: [],     // Cross-tab topic threads
  topicFrequency: {},      // topic -> count (for auto-promotion)
  lastResolution: 0,       // Timestamp of last conflict resolution
  // v3.0: Thread-based reality for Reality Arbiter
  threadRealities: {},     // threadId -> { context, timestamp, interactionCount, isActive }
};

/**
 * v3.0: Telemetry tracking for Reality Arbiter
 */
let realityTelemetry = {
  totalSyncs: 0,
  decayedContexts: 0,
  conflictsResolved: 0,
  startTime: Date.now(),
};

/**
 * Research thread tracking for topic auto-promotion
 */
let researchThreadRegistry = {
  threads: [],      // Array of { topic, count, tabs, lastSeen }
  promoted: [],     // Topics auto-promoted to currentProject
};

// Helper to get settings - handles both nested and flat storage formats
async function getSettingsFromStorage() {
  const stored = await chrome.storage.local.get(null); // Get everything
  
  // If we have the nested settings object, use it
  if (stored.settings && typeof stored.settings === 'object') {
    return { ...DEFAULT_SETTINGS, ...stored.settings };
  }
  
  // Otherwise, check for flat keys (popup saves these)
  return {
    ...DEFAULT_SETTINGS,
    enabled: stored.enabled ?? DEFAULT_SETTINGS.enabled,
    includeTimezone: stored.includeTimezone ?? DEFAULT_SETTINGS.includeTimezone,
    includeDate: stored.includeDate ?? DEFAULT_SETTINGS.includeDate,
    includeTime: stored.includeTime ?? DEFAULT_SETTINGS.includeTime,
    includeDayPart: stored.includeDayPart ?? DEFAULT_SETTINGS.includeDayPart,
    includeWeekend: stored.includeWeekend ?? DEFAULT_SETTINGS.includeWeekend,
    includeLocation: stored.includeLocation ?? DEFAULT_SETTINGS.includeLocation,
    includeWeather: stored.includeWeather ?? DEFAULT_SETTINGS.includeWeather,
    // Deep context settings
    includeBrowserTabs: stored.includeBrowserTabs ?? DEFAULT_SETTINGS.includeBrowserTabs,
    includeRecentActivity: stored.includeRecentActivity ?? DEFAULT_SETTINGS.includeRecentActivity,
    includeCurrentFocus: stored.includeCurrentFocus ?? DEFAULT_SETTINGS.includeCurrentFocus,
    includeRelevantTabs: stored.includeRelevantTabs ?? DEFAULT_SETTINGS.includeRelevantTabs,
    // Killer features
    includeClipboard: stored.includeClipboard ?? DEFAULT_SETTINGS.includeClipboard,
    includePageContent: stored.includePageContent ?? DEFAULT_SETTINGS.includePageContent,
    includeUserProfile: stored.includeUserProfile ?? DEFAULT_SETTINGS.includeUserProfile,
    // Server settings
    serverUrl: stored.serverUrl ?? DEFAULT_SETTINGS.serverUrl,
    apiKey: stored.apiKey ?? DEFAULT_SETTINGS.apiKey,
    mode: stored.mode ?? DEFAULT_SETTINGS.mode,
    autoDetect: stored.autoDetect ?? DEFAULT_SETTINGS.autoDetect,
  };
}

// ============================================================================
// SELECTION & CLIPBOARD MANAGEMENT (v3.0 with Telemetry)
// ============================================================================

// Context pivot tracking
let lastContextPivot = null;
let contextStale = false;

/**
 * Handle captured selection from any page (with intelligent analysis + telemetry)
 */
function handleSelectionCapture(payload) {
  const { 
    text, captureType, timestamp, source, pageType, 
    analysis, structured,
    // v3.0 additions
    telemetry, surroundingContext, visualContext, topics, contextPivot 
  } = payload;
  
  // Add to history with intelligent analysis + telemetry
  selectionHistory.unshift({
    text: text,
    type: captureType, // 'selection' or 'copy'
    timestamp: timestamp,
    source: source,
    pageType: pageType,
    // Intelligent analysis from selection-tracker.js
    analysis: analysis || { type: 'text', confidence: 0 },
    structured: structured || {},
    // v3.0: Telemetry data
    telemetry: telemetry || {},
    surroundingContext: surroundingContext || null,
    visualContext: visualContext || null,
    topics: topics || [],
  });
  
  // Track context pivot
  if (contextPivot?.isPivot) {
    lastContextPivot = contextPivot;
    contextStale = true;
    console.log('RAL: Context pivot detected!', contextPivot.previousTopics, '->', contextPivot.currentTopics);
  }
  
  // Keep only recent selections
  if (selectionHistory.length > MAX_SELECTIONS) {
    selectionHistory = selectionHistory.slice(0, MAX_SELECTIONS);
  }
  
  // Persist to storage
  chrome.storage.local.set({ selectionHistory: selectionHistory });
  
  // Log with intelligent info
  const analysisInfo = analysis?.type !== 'text' 
    ? ` [${analysis.type}${structured?.language ? ': ' + structured.language : ''}${structured?.problemType ? ': ' + structured.problemType : ''}]`
    : '';
  const telemetryInfo = telemetry?.readingMode ? ` (${telemetry.readingMode})` : '';
  console.log(`RAL v3: Captured ${captureType}${analysisInfo}${telemetryInfo} from ${source.domain}:`, text.substring(0, 50) + '...');
}

/**
 * Handle context pivot event
 */
function handleContextPivot(payload) {
  lastContextPivot = payload;
  contextStale = true;
  console.log('RAL: CONTEXT_PIVOT - Reality state stale. Previous:', payload.previousTopics, 'Current:', payload.currentTopics);
  
  // Could notify user or adjust context injection strategy
}

/**
 * v4.0: Frustration state tracking
 */
let lastFrustrationEvent = null;
let userFrustrationLevel = 'normal'; // 'normal', 'elevated', 'high'

/**
 * v4.0: Handle frustration detection event
 */
function handleFrustrationDetected(payload) {
  lastFrustrationEvent = {
    ...payload,
    receivedAt: Date.now(),
  };
  
  userFrustrationLevel = 'high';
  
  console.log('RAL v4.0: 🔴 FRUSTRATION_DETECTED', 
              '| Reason:', payload.reason,
              '| Domain:', payload.domain);
  
  // Auto-demote frustration level after 60 seconds
  setTimeout(() => {
    if (userFrustrationLevel === 'high') {
      userFrustrationLevel = 'elevated';
      console.log('RAL v4.0: Frustration level demoted to elevated');
    }
  }, 60000);
  
  // Reset to normal after 3 minutes
  setTimeout(() => {
    userFrustrationLevel = 'normal';
    console.log('RAL v4.0: Frustration level reset to normal');
  }, 180000);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *                       BEHAVIORAL LLM DIRECTIVES
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Generates specific System Instructions for the LLM based on telemetry.
 * Uses readingMode, cognitiveLoad, and behavioral patterns to tailor responses.
 */

/**
 * Get current behavioral state with detailed LLM System Instructions
 */
function getBehavioralState() {
  const latestSelection = selectionHistory[0];
  const telemetry = latestSelection?.telemetry || {};
  const readingMode = telemetry.readingMode;
  const cognitiveLoad = telemetry.cognitiveLoad;
  
  // Build comprehensive behavioral state
  const state = {
    level: 'normal',
    modes: [],
    systemInstructions: [],
    priority: 'standard',
  };
  
  // =========================================================================
  // FRUSTRATION STATE (HIGHEST PRIORITY)
  // =========================================================================
  if (userFrustrationLevel === 'high' && lastFrustrationEvent) {
    state.level = 'FRUSTRATED';
    state.priority = 'EMERGENCY';
    state.modes.push('frustrated');
    state.reason = lastFrustrationEvent.reason;
    state.since = lastFrustrationEvent.timestamp;
    
    // EMERGENCY DIRECTIVE
    state.systemInstructions.push(
      'EMERGENCY: User is struggling. Provide the direct fix immediately with no fluff.',
      'Skip explanations unless explicitly asked.',
      'Lead with working code or the exact solution.',
      'Use bullet points for any necessary context.',
      'If multiple solutions exist, provide the simplest one first.'
    );
    
    // Add specific directives based on frustration reason
    if (lastFrustrationEvent.reason?.includes('repeat')) {
      state.systemInstructions.push(
        'User has asked about this multiple times. Previous answers may have been unclear or incomplete.'
      );
    }
    
    return state;
  }
  
  if (userFrustrationLevel === 'elevated') {
    state.level = 'ELEVATED';
    state.priority = 'high';
    state.modes.push('elevated');
    state.systemInstructions.push(
      'User was recently frustrated. Keep responses focused and efficient.',
      'Prioritize actionable information over context.'
    );
  }
  
  // =========================================================================
  // READING MODE DIRECTIVES
  // =========================================================================
  if (readingMode === 'deep_study') {
    state.modes.push('deep_study');
    state.systemInstructions.push(
      'User is learning. Provide detailed, pedagogical explanations.',
      'Include "why" explanations, not just "how".',
      'Break down complex concepts step by step.',
      'Provide examples that build understanding incrementally.',
      'Consider adding related concepts the user might want to explore.'
    );
  } else if (readingMode === 'quick_troubleshooting') {
    state.modes.push('quick_troubleshooting');
    state.systemInstructions.push(
      'User is rapidly troubleshooting. Be concise and solution-focused.',
      'Lead with the most likely fix.',
      'Provide copy-paste ready solutions when possible.',
      'Skip lengthy background information.'
    );
  } else if (readingMode === 'skimming') {
    state.modes.push('skimming');
    state.systemInstructions.push(
      'User is skimming for information. Use clear headers and bullet points.',
      'Front-load the most important information.',
      'Make key terms and solutions visually scannable.'
    );
  } else if (readingMode === 'comparing') {
    state.modes.push('comparing');
    state.systemInstructions.push(
      'User appears to be comparing options. Consider using comparison tables.',
      'Highlight key differences and trade-offs clearly.',
      'Provide pros/cons when relevant.'
    );
  }
  
  // =========================================================================
  // COGNITIVE LOAD DIRECTIVES
  // =========================================================================
  if (cognitiveLoad === 'high' || cognitiveLoad === 'FRUSTRATED') {
    if (!state.modes.includes('frustrated')) {
      state.modes.push('high_cognitive_load');
      state.systemInstructions.push(
        'High cognitive load detected. Simplify explanations.',
        'Avoid introducing new concepts unless essential.',
        'Use familiar terminology where possible.'
      );
    }
  } else if (cognitiveLoad === 'low') {
    state.modes.push('low_cognitive_load');
    // User is comfortable - can provide richer responses
    state.systemInstructions.push(
      'User appears comfortable with the material. Feel free to include additional context and optimizations.'
    );
  }
  
  // =========================================================================
  // INTENT-BASED DIRECTIVES
  // =========================================================================
  const reality = synthesizeActiveReality();
  if (reality?.synthesis?.userIntent) {
    const intent = reality.synthesis.userIntent;
    
    if (intent === 'DEBUGGING_URGENT') {
      state.modes.push('debugging_urgent');
      state.priority = 'high';
      state.systemInstructions.push(
        'User is urgently debugging. Focus on error resolution.',
        'If you see an error message, address it directly first.'
      );
    } else if (intent === 'DEBUGGING') {
      state.modes.push('debugging');
      state.systemInstructions.push(
        'User is in debugging mode. Provide systematic troubleshooting steps.'
      );
    } else if (intent === 'PROBLEM_SOLVING') {
      state.modes.push('problem_solving');
      state.systemInstructions.push(
        'User is solving an algorithmic problem. Consider time/space complexity.',
        'Explain the approach before providing code when appropriate.'
      );
    }
  }
  
  // =========================================================================
  // SYSTEM CONSTRAINT DIRECTIVES
  // =========================================================================
  if (telemetry.system?.system_constraint) {
    const constraint = telemetry.system.system_constraint;
    state.modes.push('constrained_system');
    state.systemInstructions.push(
      `SYSTEM CONSTRAINT: ${telemetry.system.llm_hint || constraint}`,
      'Consider resource-efficient solutions.'
    );
  }
  
  // Return null if no special state detected
  if (state.systemInstructions.length === 0) {
    return null;
  }
  
  // Build unified directive string for legacy compatibility
  state.llm_directive = state.systemInstructions.join(' ');
  
  return state;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *                         CONTEXT FUSION ENGINE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Synthesizes Active Reality by calculating Relevance Scores for all context.
 * Handles CONTEXT_PIVOT events to deprioritize stale history immediately.
 */

/**
 * Calculate Relevance Score for a context piece (0-100)
 * Factors: recency, type, telemetry richness, cognitive alignment
 */
function calculateRelevanceScore(contextPiece) {
  let score = 0;
  const now = Date.now();
  const age = now - (contextPiece.timestamp || 0);
  
  // 1. RECENCY FACTOR (max 30 points)
  // Decay: 30 points at 0s, 0 points at 10min
  const recencyScore = Math.max(0, 30 - (age / (600000 / 30)));
  score += recencyScore;
  
  // 2. TYPE FACTOR (max 25 points)
  const typeScores = {
    'code': 25,
    'error_message': 25,
    'dsa_problem': 23,
    'technical_text': 20,
    'question': 18,
    'text': 10,
  };
  score += typeScores[contextPiece.analysis?.type] || 10;
  
  // 3. ACTION FACTOR (max 15 points)
  // Copies are more intentional than selections
  score += contextPiece.type === 'copy' ? 15 : 8;
  
  // 4. TELEMETRY RICHNESS (max 15 points)
  if (contextPiece.telemetry) {
    const t = contextPiece.telemetry;
    if (t.readingMode) score += 5;
    if (t.cognitiveLoad) score += 5;
    if (t.system) score += 5;
  }
  
  // 5. COGNITIVE ALIGNMENT (max 15 points)
  // Boost if matches current frustration/study state
  if (userFrustrationLevel === 'high' && contextPiece.analysis?.type === 'error_message') {
    score += 15; // Error during frustration = highly relevant
  } else if (contextPiece.telemetry?.readingMode === 'deep_study') {
    score += 10; // Deep study content is valuable
  }
  
  return Math.min(100, score);
}

/**
 * Synthesize Active Reality from all available context
 * Returns the most relevant context with scores
 */
function synthesizeActiveReality() {
  if (selectionHistory.length === 0) return null;
  
  const now = Date.now();
  
  // If CONTEXT_PIVOT was recently detected, deprioritize old history
  const pivotPenaltyThreshold = lastContextPivot?.timestamp 
    ? lastContextPivot.timestamp 
    : 0;
  
  // Score all selections
  const scoredSelections = selectionHistory.map(sel => {
    let score = calculateRelevanceScore(sel);
    
    // PIVOT PENALTY: Heavily penalize pre-pivot selections
    if (pivotPenaltyThreshold && sel.timestamp < pivotPenaltyThreshold) {
      score *= 0.3; // 70% penalty for stale context
      sel._pivotPenalized = true;
    }
    
    return { ...sel, _relevanceScore: score };
  });
  
  // Sort by relevance score
  scoredSelections.sort((a, b) => b._relevanceScore - a._relevanceScore);
  
  // Build synthesized reality
  const primary = scoredSelections[0];
  const secondary = scoredSelections[1];
  
  // Determine reality confidence
  const confidenceLevel = 
    primary._relevanceScore >= 70 ? 'HIGH' :
    primary._relevanceScore >= 40 ? 'MEDIUM' : 'LOW';
  
  return {
    primary: primary,
    secondary: secondary?._relevanceScore > 30 ? secondary : null,
    scores: {
      temporal: calculateTemporalRelevance(),
      spatial: calculateSpatialRelevance(),
      behavioral: calculateBehavioralRelevance(),
      crossTab: calculateCrossTabRelevance(),
    },
    confidence: confidenceLevel,
    pivotDetected: contextStale,
    synthesis: {
      topTopics: extractTopTopics(scoredSelections),
      dominantLanguage: extractDominantLanguage(scoredSelections),
      userIntent: inferUserIntent(scoredSelections),
    }
  };
}

/**
 * Calculate temporal context relevance (time-of-day patterns)
 */
function calculateTemporalRelevance() {
  const hour = new Date().getHours();
  // Higher relevance during work hours
  if (hour >= 9 && hour <= 18) return 80;
  if (hour >= 6 && hour <= 22) return 60;
  return 40; // Late night - lower confidence
}

/**
 * Calculate spatial context relevance (browser state)
 */
function calculateSpatialRelevance() {
  const tabCount = globalRealityMap.activeTabs.size;
  // More tabs = richer spatial context
  return Math.min(100, 40 + (tabCount * 10));
}

/**
 * Calculate behavioral context relevance
 */
function calculateBehavioralRelevance() {
  if (userFrustrationLevel === 'high') return 100; // Frustration = critical context
  if (userFrustrationLevel === 'elevated') return 80;
  if (selectionHistory[0]?.telemetry?.readingMode) return 70;
  return 50;
}

/**
 * Calculate cross-tab context relevance
 */
function calculateCrossTabRelevance() {
  const threadCount = globalRealityMap.researchThreads.length;
  if (threadCount >= 3) return 90; // Rich cross-tab research
  if (threadCount >= 1) return 70;
  return 30;
}

/**
 * Extract top topics from scored selections
 */
function extractTopTopics(scoredSelections) {
  const topicCounts = {};
  scoredSelections.forEach(sel => {
    (sel.topics || []).forEach(topic => {
      topicCounts[topic] = (topicCounts[topic] || 0) + sel._relevanceScore;
    });
  });
  return Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);
}

/**
 * Extract dominant programming language
 */
function extractDominantLanguage(scoredSelections) {
  const langScores = {};
  scoredSelections.forEach(sel => {
    const lang = sel.structured?.language;
    if (lang) {
      langScores[lang] = (langScores[lang] || 0) + sel._relevanceScore;
    }
  });
  const sorted = Object.entries(langScores).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || null;
}

/**
 * Infer user's current intent from behavior patterns
 */
function inferUserIntent(scoredSelections) {
  const types = scoredSelections.map(s => s.analysis?.type).filter(Boolean);
  const errorCount = types.filter(t => t === 'error_message').length;
  const codeCount = types.filter(t => t === 'code').length;
  const dsaCount = types.filter(t => t === 'dsa_problem').length;
  
  if (userFrustrationLevel === 'high' && errorCount > 0) return 'DEBUGGING_URGENT';
  if (errorCount >= 2) return 'DEBUGGING';
  if (dsaCount >= 1) return 'PROBLEM_SOLVING';
  if (codeCount >= 2) return 'CODING';
  return 'RESEARCHING';
}

/**
 * Legacy compatibility wrapper
 * @deprecated Use synthesizeActiveReality() instead
 */
function getMostRelevantSelection() {
  const reality = synthesizeActiveReality();
  return reality?.primary || null;
}

/**
 * Load selection history from storage on startup
 */
async function loadSelectionHistory() {
  const stored = await chrome.storage.local.get('selectionHistory');
  if (stored.selectionHistory) {
    selectionHistory = stored.selectionHistory;
  }
}

// ============================================================================
// USER PROFILE (PERSISTENT MEMORY)
// ============================================================================

/**
 * Load user profile from storage
 */
async function loadUserProfile() {
  const stored = await chrome.storage.local.get('userProfile');
  if (stored.userProfile) {
    userProfile = { ...userProfile, ...stored.userProfile };
  }
}

/**
 * Save user profile to storage
 */
async function saveUserProfile() {
  await chrome.storage.local.set({ userProfile: userProfile });
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *                       DYNAMIC PROFILE EVOLUTION
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Dynamically builds user's tech stack from incoming topics and analysis.
 * Auto-promotes topics that appear in >3 research_threads to currentProject.
 */

/**
 * Update user profile based on activity with intelligent evolution
 */
function updateUserProfile(activity) {
  const { topic, topics, domain, analysis, structured } = activity;
  let profileChanged = false;
  
  // =========================================================================
  // 1. TOPIC TRACKING with Research Thread Detection
  // =========================================================================
  const allTopics = [topic, ...(topics || [])].filter(Boolean);
  
  allTopics.forEach(t => {
    const normalizedTopic = t.toLowerCase().trim();
    
    // Track in recentTopics
    userProfile.recentTopics.unshift({
      topic: normalizedTopic,
      timestamp: Date.now(),
      source: domain || 'unknown'
    });
    
    // Track in globalRealityMap for cross-tab frequency
    globalRealityMap.topicFrequency[normalizedTopic] = 
      (globalRealityMap.topicFrequency[normalizedTopic] || 0) + 1;
    
    // Check for research thread (appears across multiple tabs/sessions)
    checkAndUpdateResearchThread(normalizedTopic, domain);
  });
  
  userProfile.recentTopics = userProfile.recentTopics.slice(0, 50);
  
  // =========================================================================
  // 2. DYNAMIC TECH STACK BUILDING from Analysis
  // =========================================================================
  
  // Extract tech from structured analysis (code language, frameworks)
  if (structured?.language) {
    addToTechStack(structured.language);
    profileChanged = true;
  }
  
  // Extract tech from analysis type and content
  if (analysis?.type === 'code' || analysis?.type === 'error_message') {
    const detectedTech = detectTechFromContent(activity);
    detectedTech.forEach(tech => {
      addToTechStack(tech);
      profileChanged = true;
    });
  }
  
  // Extract from topics themselves
  const techTopics = ['react', 'vue', 'angular', 'python', 'javascript', 'typescript',
    'rust', 'go', 'java', 'kotlin', 'swift', 'docker', 'kubernetes', 'aws', 'gcp',
    'azure', 'node', 'deno', 'bun', 'nextjs', 'remix', 'svelte', 'tailwind',
    'graphql', 'rest', 'grpc', 'mongodb', 'postgresql', 'redis', 'kafka'];
  
  allTopics.forEach(t => {
    const normalized = t.toLowerCase();
    if (techTopics.includes(normalized)) {
      addToTechStack(normalized);
      profileChanged = true;
    }
  });
  
  // =========================================================================
  // 3. AUTO-PROMOTE to currentProject if topic appears in >3 research threads
  // =========================================================================
  checkAutoPromotion();
  
  if (profileChanged) {
    saveUserProfile();
  }
}

/**
 * Add technology to stack if not already present
 */
function addToTechStack(tech) {
  const normalized = tech.toLowerCase().trim();
  if (normalized && !userProfile.techStack.includes(normalized)) {
    userProfile.techStack.push(normalized);
    console.log(`RAL v2: Tech stack evolved: +${normalized}`);
  }
}

/**
 * Detect technologies from content analysis
 */
function detectTechFromContent(activity) {
  const detected = [];
  const text = (activity.text || '').toLowerCase();
  const structured = activity.structured || {};
  
  // Framework detection patterns
  const patterns = {
    'react': /\b(usestate|useeffect|useref|jsx|react\.component|createroot)\b/i,
    'vue': /\b(v-if|v-for|v-model|vue\.component|createapp)\b/i,
    'angular': /\b(ngif|ngfor|@component|@injectable|ngmodule)\b/i,
    'express': /\b(app\.get|app\.post|express\(\)|router\.)\b/i,
    'fastapi': /\b(fastapi|@app\.get|@app\.post|pydantic)\b/i,
    'django': /\b(django|models\.model|views\.py|urls\.py)\b/i,
    'flask': /\b(flask|@app\.route|render_template)\b/i,
    'pytorch': /\b(torch\.|nn\.module|tensor|cuda)\b/i,
    'tensorflow': /\b(tf\.|keras|tensorflow)\b/i,
  };
  
  for (const [tech, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      detected.push(tech);
    }
  }
  
  // Also check structured language
  if (structured.language) {
    detected.push(structured.language);
  }
  
  return [...new Set(detected)];
}

/**
 * Check and update research thread for a topic
 */
function checkAndUpdateResearchThread(topic, domain) {
  const existing = researchThreadRegistry.threads.find(t => t.topic === topic);
  
  if (existing) {
    existing.count++;
    existing.lastSeen = Date.now();
    if (domain && !existing.tabs.includes(domain)) {
      existing.tabs.push(domain);
    }
  } else {
    researchThreadRegistry.threads.push({
      topic,
      count: 1,
      tabs: domain ? [domain] : [],
      lastSeen: Date.now()
    });
  }
  
  // Cleanup old threads (older than 1 hour)
  const oneHourAgo = Date.now() - 3600000;
  researchThreadRegistry.threads = researchThreadRegistry.threads
    .filter(t => t.lastSeen > oneHourAgo);
}

/**
 * Auto-promote topics with >3 research threads to currentProject
 */
function checkAutoPromotion() {
  const promotionThreshold = 3;
  
  for (const thread of researchThreadRegistry.threads) {
    if (thread.count > promotionThreshold && 
        !researchThreadRegistry.promoted.includes(thread.topic)) {
      
      // Auto-promote to current project!
      const oldProject = userProfile.currentProject;
      userProfile.currentProject = thread.topic;
      researchThreadRegistry.promoted.push(thread.topic);
      
      console.log(`RAL v2: 🎯 AUTO-PROMOTED "${thread.topic}" to currentProject`,
                  `(appeared in ${thread.count} research threads across ${thread.tabs.length} domains)`);
      
      // Keep old project in focus history
      if (oldProject && oldProject !== thread.topic) {
        userProfile.projectHistory = userProfile.projectHistory || [];
        userProfile.projectHistory.unshift({ project: oldProject, until: Date.now() });
        userProfile.projectHistory = userProfile.projectHistory.slice(0, 10);
      }
      
      saveUserProfile();
      break; // Only promote one at a time
    }
  }
}

/**
 * Set custom user context (called from popup/options)
 */
function setUserCustomContext(context) {
  userProfile.customContext = context;
  saveUserProfile();
}

/**
 * Set current project (called from popup/options)
 */
function setCurrentProject(project) {
  userProfile.currentProject = project;
  saveUserProfile();
}

// ============================================================================
// ACTIVE PAGE CONTENT
// ============================================================================

/**
 * Get content from the active tab
 */
async function getActivePageContent() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    
    // Don't extract from AI chat pages
    const aiDomains = ['chat.openai.com', 'chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai', 'poe.com'];
    if (aiDomains.some(d => tab.url?.includes(d))) return null;
    
    // Request content from the selection tracker script
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });
    return response;
  } catch (e) {
    console.warn('RAL: Could not get page content', e);
    return null;
  }
}

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  // Load persistent data
  await loadSelectionHistory();
  await loadUserProfile();
  
  const stored = await chrome.storage.local.get('settings');
  if (!stored.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  
  // Generate unique user ID if not set
  if (!stored.settings?.userId) {
    const userId = `ral_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await chrome.storage.local.set({
      settings: { ...stored.settings, userId }
    });
  }
  
  console.log(`RAL Extension v${RAL_VERSION} ${details.reason === 'install' ? 'installed' : 'updated'}`);
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║       RAL CORTEX v${RAL_VERSION} - Neural Backend Online              ║
║                                                               ║
║  • Global Reality Mapping:  ACTIVE                            ║
║  • Reality Decay Engine:    ACTIVE (${REALITY_DECAY_THRESHOLD / 60000}min threshold)           ║
║  • Context Fusion:          ACTIVE                            ║
║  • Behavioral Directives:   ACTIVE                            ║
║  • Cross-Tab Arbiter:       ACTIVE                            ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

// ============================================================================
// v3.0: REALITY DECAY ENGINE
// ============================================================================

/**
 * Reality Decay Loop - Prevents "hallucinations" from stale contexts
 * Runs every minute to clean up contexts that haven't been touched
 * This is CRITICAL for the Reality Arbiter to make accurate decisions
 */
setInterval(() => {
  const now = Date.now();
  let decayedTabs = 0;
  let decayedThreads = 0;
  
  // 1. Decay stale tab contexts (10 min threshold)
  for (const [tabId, data] of globalRealityMap.activeTabs.entries()) {
    if (now - data.lastUpdate > REALITY_DECAY_THRESHOLD) {
      globalRealityMap.activeTabs.delete(tabId);
      decayedTabs++;
    }
  }
  
  // 2. Decay stale research threads (30 min threshold)  
  const oldThreadCount = globalRealityMap.researchThreads.length;
  globalRealityMap.researchThreads = globalRealityMap.researchThreads
    .filter(thread => now - thread.lastSeen < RESEARCH_DECAY_THRESHOLD);
  decayedThreads = oldThreadCount - globalRealityMap.researchThreads.length;
  
  // 3. Decay thread realities (for Reality Arbiter)
  for (const [threadId, reality] of Object.entries(globalRealityMap.threadRealities)) {
    if (now - reality.timestamp > REALITY_DECAY_THRESHOLD) {
      delete globalRealityMap.threadRealities[threadId];
      decayedTabs++;
    }
  }
  
  // 4. Re-resolve primary context after decay
  if (decayedTabs > 0) {
    resolvePrimaryContext();
  }
  
  // 5. Update telemetry
  if (decayedTabs > 0 || decayedThreads > 0) {
    realityTelemetry.decayedContexts += decayedTabs + decayedThreads;
    console.log(`RAL v3.0 Entropy: Decayed ${decayedTabs} tab(s), ${decayedThreads} thread(s). ` +
                `Active: ${globalRealityMap.activeTabs.size} tabs, ${globalRealityMap.researchThreads.length} threads`);
  }
}, REALITY_DECAY_INTERVAL);

/**
 * v3.0: Prepare the Global Reality Map for the Reality Arbiter in ral-core.js
 * - Marks the requesting thread as "active"
 * - Includes interaction scores for arbiter decision-making
 */
function prepareRealityMapForArbiter(requestingTabId) {
  const preparedMap = {};
  const requestingId = requestingTabId?.toString();
  
  // Include thread-based realities
  for (const [threadId, reality] of Object.entries(globalRealityMap.threadRealities)) {
    preparedMap[threadId] = {
      ...reality,
      isActive: (threadId === requestingId)
    };
  }
  
  // Also include tab-based contexts (converted to thread format)
  for (const [tabId, data] of globalRealityMap.activeTabs.entries()) {
    const threadId = tabId.toString();
    if (!preparedMap[threadId]) {
      preparedMap[threadId] = {
        context: {
          userIntent: data.topics?.[0] || 'GENERAL',
          primaryLanguage: data.language,
          topics: data.topics,
        },
        timestamp: data.lastUpdate,
        interactionCount: data.interactionScore || 1,
        isActive: (threadId === requestingId),
        threadId: threadId
      };
    }
  }
  
  realityTelemetry.totalSyncs++;
  return preparedMap;
}

/**
 * v3.0: Update thread reality (called from GET_CONTEXT handler)
 */
function updateThreadReality(threadId, contextData) {
  globalRealityMap.threadRealities[threadId] = {
    context: contextData.synthesis || contextData,
    fullContext: contextData.context,
    timestamp: Date.now(),
    interactionCount: (globalRealityMap.threadRealities[threadId]?.interactionCount || 0) + 1,
    isActive: true,
    threadId: threadId
  };
}


// ============================================================================
// CONTEXT GENERATION (LOCAL)
// ============================================================================

function generateLocalContext() {
  const now = new Date();
  
  return {
    // Core temporal
    timestamp: now.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    utcOffset: now.getTimezoneOffset(),
    
    // Human-readable
    localTime: now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    }),
    localDate: now.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    shortDate: now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    
    // Structured
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
    dayOfWeekShort: now.toLocaleDateString('en-US', { weekday: 'short' }),
    
    // Computed
    isWeekend: [0, 6].includes(now.getDay()),
    dayPart: getDayPart(now.getHours()),
    quarter: Math.ceil((now.getMonth() + 1) / 3),
    
    // Locale
    locale: navigator.language,
    languages: navigator.languages,
  };
}

function getDayPart(hour) {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}


// ============================================================================
// DEEP CONTEXT GENERATION (Browser Intelligence)
// ============================================================================

/**
 * Get all open browser tabs - provides context about what user is working on
 */
async function getOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    return tabs
      .filter(tab => tab.url && !tab.url.startsWith('chrome://'))
      .map(tab => ({
        title: tab.title || 'Untitled',
        url: new URL(tab.url).hostname,
        active: tab.active,
        pinned: tab.pinned,
      }))
      .slice(0, 15); // Limit to 15 most relevant tabs
  } catch (e) {
    console.warn('RAL: Could not get tabs', e);
    return [];
  }
}

/**
 * Get recent browsing history - shows user's recent research/interests
 */
async function getRecentHistory(minutes = 60) {
  try {
    const startTime = Date.now() - (minutes * 60 * 1000);
    const history = await chrome.history.search({
      text: '',
      startTime: startTime,
      maxResults: 20
    });
    
    // Group by domain and count visits
    const domainCounts = {};
    history.forEach(item => {
      try {
        const domain = new URL(item.url).hostname;
        if (!domain.includes('chrome://') && !domain.includes('newtab')) {
          domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        }
      } catch (e) {}
    });
    
    // Get top domains
    return Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, visits]) => ({ domain, visits }));
  } catch (e) {
    console.warn('RAL: Could not get history', e);
    return [];
  }
}

/**
 * Categorize tabs to understand user's current focus
 */
function categorizeTabs(tabs) {
  const categories = {
    coding: ['github.com', 'stackoverflow.com', 'gitlab.com', 'codepen.io', 'replit.com', 'codesandbox.io', 'leetcode.com'],
    research: ['scholar.google.com', 'arxiv.org', 'wikipedia.org', 'medium.com', 'dev.to'],
    social: ['twitter.com', 'x.com', 'linkedin.com', 'facebook.com', 'reddit.com', 'instagram.com'],
    work: ['docs.google.com', 'sheets.google.com', 'notion.so', 'figma.com', 'slack.com', 'teams.microsoft.com', 'zoom.us'],
    shopping: ['amazon.com', 'ebay.com', 'etsy.com', 'walmart.com'],
    entertainment: ['youtube.com', 'netflix.com', 'spotify.com', 'twitch.tv'],
    ai: ['chat.openai.com', 'chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai', 'poe.com'],
    email: ['mail.google.com', 'outlook.com', 'yahoo.com'],
    news: ['news.google.com', 'bbc.com', 'cnn.com', 'reuters.com', 'techcrunch.com', 'theverge.com'],
  };
  
  const counts = {};
  tabs.forEach(tab => {
    for (const [category, domains] of Object.entries(categories)) {
      if (domains.some(d => tab.url.includes(d))) {
        counts[category] = (counts[category] || 0) + 1;
        break;
      }
    }
  });
  
  // Get primary focus
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return {
    primary: sorted[0]?.[0] || 'general',
    secondary: sorted[1]?.[0] || null,
    breakdown: counts
  };
}

/**
 * Extract relevant tab titles for context (non-AI tabs)
 */
function getRelevantTabContext(tabs) {
  const aiDomains = ['chat.openai.com', 'chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai', 'poe.com'];
  
  return tabs
    .filter(tab => !aiDomains.some(ai => tab.url.includes(ai)))
    .filter(tab => tab.title && tab.title.length > 3)
    .slice(0, 5)
    .map(tab => tab.title);
}

/**
 * Generate a comprehensive deep context object
 */
async function generateDeepContext(settings) {
  const context = {
    basic: generateLocalContext(),
    browser: {},
    activity: {},
    focus: null,
  };
  
  // Get browser context if enabled
  if (settings.includeBrowserTabs !== false) {
    try {
      const tabs = await getOpenTabs();
      context.browser.openTabs = tabs.length;
      context.browser.tabCategories = categorizeTabs(tabs);
      context.browser.relevantTabs = getRelevantTabContext(tabs);
      context.focus = context.browser.tabCategories.primary;
    } catch (e) {
      console.warn('RAL: Error getting browser context', e);
    }
  }
  
  // Get recent activity if enabled
  if (settings.includeRecentActivity !== false) {
    try {
      context.activity.recentSites = await getRecentHistory(60);
    } catch (e) {
      console.warn('RAL: Error getting activity', e);
    }
  }
  
  // =========================================================================
  // KILLER FEATURE #1: Clipboard/Selection Context (v2.0: Uses Fusion Engine)
  // =========================================================================
  if (settings.includeClipboard !== false) {
    const synthesizedReality = synthesizeActiveReality();
    if (synthesizedReality?.primary) {
      context.selection = synthesizedReality.primary;
      context.selectionSynthesis = {
        confidence: synthesizedReality.confidence,
        scores: synthesizedReality.scores,
        topTopics: synthesizedReality.synthesis?.topTopics,
        dominantLanguage: synthesizedReality.synthesis?.dominantLanguage,
        userIntent: synthesizedReality.synthesis?.userIntent,
      };
    }
  }
  
  // =========================================================================
  // KILLER FEATURE #2: User Profile / Persistent Memory
  // =========================================================================
  if (settings.includeUserProfile !== false) {
    context.userProfile = { ...userProfile };
  }
  
  // =========================================================================
  // KILLER FEATURE #3: Active Page Content
  // =========================================================================
  if (settings.includePageContent !== false) {
    try {
      const pageContent = await getActivePageContent();
      if (pageContent) {
        context.pageContent = pageContent;
      }
    } catch (e) {
      console.warn('RAL: Error getting page content', e);
    }
  }
  
  // =========================================================================
  // KILLER FEATURE #4: "The Sonic Bridge" - Live Video Captions
  // Captures captions from YouTube and Google Meet
  // Supports "pause and ask" workflow - captures currently visible caption
  // =========================================================================
  if (settings.includeSonicBridge !== false) {
    try {
      const sonicData = await getSonicBridgeCaptions();
      // Check for 'rawCaptions' (matches sonic-bridge.js)
      if (sonicData && sonicData.rawCaptions && sonicData.rawCaptions.length > 0) {
        context.sonicBridge = {
          platform: sonicData.platform,
          captionCount: sonicData.captionCount,
          bufferDuration: sonicData.durationMs,
          // The current/last caption (what user likely paused on)
          currentCaption: sonicData.currentCaption || null,
          // Format recent captions for context
          recentCaptions: sonicData.rawCaptions.map(c => ({
            text: c.text,
            speaker: c.speaker,
            timeAgo: formatTimeAgo(c.timestamp)
          })).slice(-10) // Last 10 captions
        };
        console.log('RAL: Sonic Bridge captured', context.sonicBridge.captionCount, 'captions');
        if (sonicData.currentCaption) {
          console.log('RAL: Current caption (paused on):', sonicData.currentCaption.text.substring(0, 50));
        }
      }
    } catch (e) {
      console.warn('RAL: Error getting Sonic Bridge captions', e);
    }
  }
  
  // =========================================================================
  // KILLER FEATURE #5: "Rich Tab Context" - Active Resources
  // Top 5 non-AI tabs the user has open, sorted by recency
  // =========================================================================
  if (settings.includeRichTabContext !== false) {
    try {
      const richTabContext = await getRichTabContext();
      if (richTabContext) {
        context.richTabContext = richTabContext;
      }
    } catch (e) {
      console.warn('RAL: Error getting Rich Tab Context', e);
    }
  }
  
  // =========================================================================
  // KILLER FEATURE #6: "Temporal Context" - Recent History Summary
  // History from the past hour, grouped by domain
  // =========================================================================
  if (settings.includeHistorySummary !== false) {
    try {
      const historySummary = await getHistorySummary();
      if (historySummary) {
        context.historySummary = historySummary;
      }
    } catch (e) {
      console.warn('RAL: Error getting History Summary', e);
    }
  }
  
  return context;
}

// Helper function for Sonic Bridge timestamp formatting
function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}


// ============================================================================
// SERVER INTEGRATION
// ============================================================================

async function fetchServerContext(settings, prompt, platform) {
  if (!settings.serverUrl) return null;
  
  const endpoint = `${settings.serverUrl}/api/v0/prompt/augment`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey && { 'Authorization': `Bearer ${settings.apiKey}` }),
      },
      body: JSON.stringify({
        user_id: settings.userId || 'anonymous',
        prompt: prompt,
        provider: mapPlatformToProvider(platform),
        signals: {
          timestamp: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: navigator.language,
        },
        options: {
          max_context_tokens: settings.maxContextTokens,
          injection_style: 'system',
        }
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    if (!response.ok) {
      console.warn(`RAL server returned ${response.status}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.warn('RAL server unreachable, using local context:', error.message);
    return null;
  }
}

function mapPlatformToProvider(platform) {
  const map = {
    'chatgpt': 'openai',
    'claude': 'anthropic',
    'gemini': 'google',
    'perplexity': 'perplexity',
    'poe': 'poe',
    'huggingchat': 'huggingface',
    'ollama': 'ollama',
    'lmstudio': 'lmstudio',
  };
  return map[platform] || 'openai';
}

async function checkServerHealth(serverUrl) {
  if (!serverUrl) return { healthy: false, reason: 'no_server_configured' };
  
  try {
    const response = await fetch(`${serverUrl}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    
    if (response.ok) {
      const data = await response.json();
      return { healthy: true, version: data.version, latency: data.latency };
    }
    return { healthy: false, reason: 'unhealthy_response' };
  } catch (error) {
    return { healthy: false, reason: error.message };
  }
}


// ============================================================================
// INTELLIGENT SELECTION FORMATTING
// ============================================================================

/**
 * Format selection with intelligent analysis
 * This is where RAL provides DEEP context that LLMs cannot know
 */
function formatIntelligentSelection(sel) {
  const analysis = sel.analysis;
  const structured = sel.structured;
  const action = sel.type === 'copy' ? 'copied' : 'selected';
  
  // DSA / Algorithm Problem
  if (analysis.type === 'dsa_problem') {
    const parts = [`User ${action} a DSA problem`];
    
    if (structured.problemType) {
      parts[0] += ` (${structured.problemType})`;
    }
    
    if (structured.difficulty) {
      parts.push(`Difficulty: ${structured.difficulty}`);
    }
    
    if (structured.platform) {
      parts.push(`Platform: ${structured.platform}`);
    }
    
    if (structured.leetcode?.problemNumber) {
      parts.push(`LeetCode #${structured.leetcode.problemNumber}: ${structured.leetcode.problemTitle || ''}`);
    }
    
    if (structured.dataStructures?.length > 0) {
      parts.push(`Data structures involved: ${structured.dataStructures.join(', ')}`);
    }
    
    if (structured.algorithms?.length > 0) {
      parts.push(`Algorithms/techniques: ${structured.algorithms.join(', ')}`);
    }
    
    if (structured.constraints?.length > 0) {
      parts.push(`Constraints: ${structured.constraints.slice(0, 3).join(', ')}`);
    }
    
    // Include a snippet of the problem
    const snippet = sel.text.substring(0, 300).replace(/\n/g, ' ').trim();
    parts.push(`Problem snippet: "${snippet}${sel.text.length > 300 ? '...' : ''}"`);
    
    // v3.0: Add telemetry context
    if (sel.telemetry) {
      const telemetryParts = formatTelemetryContext(sel.telemetry);
      if (telemetryParts) parts.push(telemetryParts);
    }
    
    // v3.0: Add surrounding context for scope
    if (sel.surroundingContext?.before || sel.surroundingContext?.after) {
      parts.push(`Surrounding code available for context`);
    }
    
    return parts.join(' | ');
  }
  
  // Code snippet
  if (analysis.type === 'code') {
    const lang = structured.language || 'unknown';
    const codeType = structured.codeType || 'snippet';
    
    const parts = [`User ${action} ${lang} code (${codeType})`];
    
    // Add detection method (v3.0)
    if (analysis.detectionMethod && analysis.detectionMethod !== 'pattern') {
      parts.push(`Detected by: ${analysis.detectionMethod}`);
    }
    
    // Add source info
    if (sel.pageType && sel.pageType !== 'webpage') {
      parts.push(`Source: ${sel.pageType}`);
    }
    
    // v3.0: Include surrounding context if available
    if (sel.surroundingContext) {
      const { before, selected, after } = sel.surroundingContext;
      const fullContext = [before, selected, after].filter(Boolean).join('\n');
      parts.push(`Code with context:\n\`\`\`${lang}\n${fullContext.substring(0, 800)}${fullContext.length > 800 ? '\n...' : ''}\n\`\`\``);
    } else {
      // Include the code
      const codeSnippet = sel.text.substring(0, 500).trim();
      parts.push(`Code:\n\`\`\`${lang}\n${codeSnippet}${sel.text.length > 500 ? '\n...' : ''}\n\`\`\``);
    }
    
    // v3.0: Add telemetry context
    if (sel.telemetry) {
      const telemetryParts = formatTelemetryContext(sel.telemetry);
      if (telemetryParts) parts.push(telemetryParts);
    }
    
    return parts.join(' | ');
  }
  
  // Error message
  if (analysis.type === 'error_message') {
    const parts = [`User ${action} an error/stack trace`];
    
    // v3.0: Detection method
    if (analysis.detectionMethod === 'visual_error' || analysis.detectionMethod === 'css_visual') {
      parts.push(`(Detected by visual styling - red/monospace text)`);
    }
    
    if (structured.language) {
      parts.push(`Language: ${structured.language}`);
    }
    
    if (structured.errorType) {
      parts.push(`Error type: ${structured.errorType}`);
    }
    
    if (structured.errorMessage) {
      parts.push(`Message: ${structured.errorMessage}`);
    }
    
    if (structured.file && structured.line) {
      parts.push(`Location: ${structured.file}:${structured.line}`);
    }
    
    // Include full error for context
    const errorText = sel.text.substring(0, 400).trim();
    parts.push(`Full error:\n${errorText}${sel.text.length > 400 ? '...' : ''}`);
    
    // v3.0: Telemetry - if high cognitive load, note it
    if (sel.telemetry?.cognitiveLoad === 'high') {
      parts.push(`⚠️ User appears confused (long dwell time on this error)`);
    }
    
    return parts.join(' | ');
  }
  
  // Question
  if (analysis.type === 'question') {
    const truncated = sel.text.substring(0, 300).trim();
    return `User ${action} a question: "${truncated}${sel.text.length > 300 ? '...' : ''}"`;
  }
  
  // Technical text
  if (analysis.type === 'technical_text') {
    const truncated = sel.text.substring(0, 300).trim();
    const source = sel.source?.domain || 'unknown';
    return `User ${action} technical content from ${source}: "${truncated}${sel.text.length > 300 ? '...' : ''}"`;
  }
  
  // Default - shouldn't reach here if analysis.type !== 'text'
  return null;
}

/**
 * Format telemetry context for injection (v4.0 Enhanced)
 */
function formatTelemetryContext(telemetry) {
  if (!telemetry) return null;
  
  const parts = [];
  
  // v4.0: Frustration state takes priority
  if (telemetry.cognitiveLoad === 'FRUSTRATED') {
    parts.push('🔴 User is frustrated - prioritize concise, actionable solutions');
    
    if (telemetry.frustration?.recentSelectionRepeats > 3) {
      parts.push(`(selected same text ${telemetry.frustration.recentSelectionRepeats} times)`);
    }
  }
  // Reading mode
  else if (telemetry.readingMode === 'deep_study') {
    parts.push('User is in deep study mode (slow scrolling, careful reading)');
  } else if (telemetry.readingMode === 'quick_troubleshooting') {
    parts.push('User is quickly troubleshooting (fast scrolling, searching for solution)');
  }
  
  // Cognitive load (if not frustrated)
  if (telemetry.cognitiveLoad === 'high' && telemetry.cognitiveLoad !== 'FRUSTRATED') {
    parts.push('High cognitive load detected (user may be confused)');
  }
  
  // v4.0: System constraints
  if (telemetry.system?.system_constraint) {
    parts.push(`System: ${telemetry.system.llm_hint || telemetry.system.system_constraint}`);
  }
  
  return parts.length > 0 ? parts.join(' | ') : null;
}


// ============================================================================
// CONTEXT FORMATTING
// ============================================================================

/**
 * Format basic temporal context
 */
function formatBasicContext(context, settings) {
  const parts = [];
  
  if (settings.includeDate) {
    parts.push(`Date: ${context.localDate}`);
  }
  
  if (settings.includeTime && settings.includeTimezone) {
    parts.push(`Time: ${context.localTime} (${context.timezone})`);
  } else if (settings.includeTime) {
    parts.push(`Time: ${context.localTime}`);
  } else if (settings.includeTimezone) {
    parts.push(`Timezone: ${context.timezone}`);
  }
  
  if (settings.includeDayPart) {
    parts.push(`Part of day: ${context.dayPart}`);
  }
  
  if (settings.includeWeekend && context.isWeekend) {
    parts.push(`It's the weekend`);
  }
  
  return parts.join(' | ');
}

/**
 * Format deep context (browser intelligence)
 */
function formatDeepContext(deepContext, settings) {
  const sections = [];
  
  // Basic temporal
  if (deepContext.basic) {
    const basicStr = formatBasicContext(deepContext.basic, settings);
    if (basicStr) {
      sections.push(basicStr);
    }
  }
  
  // Browser focus
  if (settings.includeCurrentFocus && deepContext.focus) {
    const focusMap = {
      coding: "User appears to be coding/programming",
      research: "User is doing research",
      social: "User is on social media",
      work: "User is working (docs/productivity)",
      shopping: "User is shopping online",
      entertainment: "User is watching/listening to content",
      email: "User is checking email",
      news: "User is reading news",
      general: "General browsing"
    };
    sections.push(`Current activity: ${focusMap[deepContext.focus] || deepContext.focus}`);
  }
  
  // Open tabs summary
  if (settings.includeBrowserTabs && deepContext.browser?.openTabs) {
    sections.push(`${deepContext.browser.openTabs} browser tabs open`);
  }
  
  // Relevant tab titles (what user is looking at)
  if (settings.includeRelevantTabs && deepContext.browser?.relevantTabs?.length > 0) {
    const tabTitles = deepContext.browser.relevantTabs.slice(0, 3).join('; ');
    sections.push(`Recently viewed: ${tabTitles}`);
  }
  
  // Recent activity domains
  if (settings.includeRecentActivity && deepContext.activity?.recentSites?.length > 0) {
    const topSites = deepContext.activity.recentSites
      .slice(0, 3)
      .map(s => s.domain.replace('www.', ''))
      .join(', ');
    sections.push(`Recent sites: ${topSites}`);
  }
  
  // =========================================================================
  // KILLER FEATURE #1: Clipboard/Selection Context (INTELLIGENT)
  // =========================================================================
  if (settings.includeClipboard && deepContext.selection) {
    const sel = deepContext.selection;
    
    // Use intelligent analysis if available
    if (sel.analysis && sel.analysis.type !== 'text') {
      const intelligentContext = formatIntelligentSelection(sel);
      if (intelligentContext) {
        sections.push(intelligentContext);
      }
    } else {
      // Fallback to basic formatting
      const truncatedText = sel.text.length > 200 
        ? sel.text.substring(0, 200) + '...' 
        : sel.text;
      
      const sourceInfo = sel.pageType !== 'webpage' 
        ? ` from ${sel.pageType}` 
        : ` from ${sel.source.domain}`;
      
      if (sel.type === 'copy') {
        sections.push(`User recently copied${sourceInfo}: "${truncatedText}"`);
      } else {
        sections.push(`User recently selected${sourceInfo}: "${truncatedText}"`);
      }
    }
  }
  
  // =========================================================================
  // KILLER FEATURE #2: User Profile / Persistent Memory
  // =========================================================================
  if (settings.includeUserProfile && deepContext.userProfile) {
    const profile = deepContext.userProfile;
    
    if (profile.currentProject) {
      sections.push(`Current project: ${profile.currentProject}`);
    }
    
    if (profile.techStack?.length > 0) {
      sections.push(`User's tech stack: ${profile.techStack.join(', ')}`);
    }
    
    if (profile.customContext) {
      sections.push(`User note: ${profile.customContext}`);
    }
  }
  
  // =========================================================================
  // KILLER FEATURE #3: Active Page Content (with CP/DSA support)
  // =========================================================================
  if (settings.includePageContent && deepContext.pageContent) {
    const page = deepContext.pageContent;
    
    // LeetCode specific
    if (page.type === 'leetcode') {
      const parts = ['Viewing LeetCode problem'];
      if (page.problemNumber) {
        parts[0] = `Viewing LeetCode #${page.problemNumber}`;
      }
      if (page.problemTitle) {
        parts.push(`"${page.problemTitle}"`);
      }
      if (page.difficulty) {
        parts.push(`(${page.difficulty})`);
      }
      sections.push(parts.join(' '));
      
      if (page.topics?.length > 0) {
        sections.push(`Topics: ${page.topics.join(', ')}`);
      }
      if (page.description) {
        const snippet = page.description.substring(0, 200).replace(/\n/g, ' ');
        sections.push(`Problem: ${snippet}...`);
      }
    }
    // GeeksforGeeks specific
    else if (page.type === 'geeksforgeeks') {
      sections.push(`Viewing GeeksforGeeks: "${page.title || 'Problem'}"`);
      if (page.difficulty) {
        sections.push(`Difficulty: ${page.difficulty}`);
      }
    }
    // GitHub
    else if (page.type === 'github-issue') {
      sections.push(`Viewing GitHub issue: "${page.issueTitle}" in ${page.repo}`);
      if (page.labels?.length > 0) {
        sections.push(`Labels: ${page.labels.join(', ')}`);
      }
    } else if (page.type === 'github-pr') {
      sections.push(`Viewing GitHub PR: "${page.prTitle}" in ${page.repo}`);
    } else if (page.type === 'github-code') {
      sections.push(`Viewing code file: ${page.fileName} in ${page.repo}`);
    }
    // Stack Overflow
    else if (page.type === 'stackoverflow') {
      sections.push(`Viewing Stack Overflow: "${page.questionTitle}"`);
      if (page.tags?.length > 0) {
        sections.push(`Tags: ${page.tags.join(', ')}`);
      }
    }
    // Documentation
    else if (page.type === 'documentation') {
      sections.push(`Reading documentation: ${page.title || page.heading}`);
    }
    // Other known types
    else if (page.type !== 'webpage' && page.title) {
      sections.push(`Viewing ${page.type}: ${page.title}`);
    }
  }
  
  // =========================================================================
  // v4.0: BEHAVIORAL STATE (Frustration Detection)
  // =========================================================================
  const behavioralState = getBehavioralState();
  if (behavioralState) {
    if (behavioralState.state === 'FRUSTRATED') {
      sections.push(`⚠️ BEHAVIORAL ALERT: ${behavioralState.llm_directive}`);
    } else if (behavioralState.state === 'ELEVATED') {
      sections.push(`Note: ${behavioralState.llm_directive}`);
    }
  }
  
  // =========================================================================
  // v4.0: GLOBAL CONTEXT (Cross-Tab Unified Reality)
  // =========================================================================
  if (deepContext.selection?.globalContext) {
    const global = deepContext.selection.globalContext;
    if (global.thread_count > 0) {
      const domains = global.domains_in_use.slice(0, 3).join(', ');
      sections.push(`Active research across ${global.thread_count} tabs: ${domains}`);
      
      if (global.unified_topics?.length > 0) {
        sections.push(`Related topics: ${global.unified_topics.slice(0, 5).join(', ')}`);
      }
    }
  }
  
  // =========================================================================
  // v4.0: SYSTEM CONSTRAINTS (Hardware-Aware Reality)
  // =========================================================================
  if (deepContext.selection?.telemetry?.system) {
    const sys = deepContext.selection.telemetry.system;
    if (sys.system_constraint) {
      sections.push(`⚡ ${sys.llm_hint || `System: ${sys.system_constraint}`}`);
    }
  }
  
  return sections.join(' | ');
}

/**
 * Legacy function for backward compatibility
 */
function formatContextString(context, settings) {
  // If it's a deep context object, use the new formatter
  if (context.basic) {
    return formatDeepContext(context, settings);
  }
  // Otherwise, it's a basic context object
  return formatBasicContext(context, settings);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *                       ADAPTIVE INJECTION FORMATS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Creates Multimodal Context Wrapper using XML-style tags to separate:
 * - Hardware State
 * - Behavioral State  
 * - Knowledge Context
 * 
 * This allows the LLM to parse the reality layer more effectively.
 */

/**
 * Build multimodal context wrapper with separated sections
 */
function buildMultimodalContextWrapper(deepContext) {
  const sections = [];
  const behavioralState = getBehavioralState();
  const reality = synthesizeActiveReality();
  
  // =========================================================================
  // TASK CONTEXT SECTION (HIGHEST VALUE - per ChatGPT feedback)
  // "This single block will improve results more than any hardware data"
  // =========================================================================
  const taskContent = [];
  
  if (userProfile.taskContext) {
    const task = userProfile.taskContext;
    if (task.goal) taskContent.push(`Goal: ${task.goal}`);
    if (task.currentStep) taskContent.push(`Current Step: ${task.currentStep}`);
    if (task.successCriteria) taskContent.push(`Success Criteria: ${task.successCriteria}`);
    if (task.nonGoals) taskContent.push(`Non-Goals: ${task.nonGoals}`);
  }
  
  // Also add project context here (high value)
  if (deepContext.userProfile?.currentProject) {
    taskContent.push(`Project: ${deepContext.userProfile.currentProject}`);
  }
  
  if (taskContent.length > 0) {
    sections.push({
      tag: 'task_context',
      content: taskContent.join('\n')
    });
  }
  
  // =========================================================================
  // HARDWARE STATE SECTION (LOWER VALUE - mostly cosmetic)
  // =========================================================================
  const hardwareState = [];
  
  // Temporal context
  if (deepContext.basic) {
    hardwareState.push(`Time: ${deepContext.basic.localTime} (${deepContext.basic.timezone})`);
    hardwareState.push(`Date: ${deepContext.basic.localDate}`);
    hardwareState.push(`Day Part: ${deepContext.basic.dayPart}`);
    if (deepContext.basic.isWeekend) hardwareState.push('Weekend: true');
  }
  
  // System constraints from telemetry
  const telemetry = reality?.primary?.telemetry;
  if (telemetry?.system) {
    const sys = telemetry.system;
    // Network: Show honest type with note about API limitations
    if (sys.connection_type) {
      // Note: Web API maxes out at '4g' - actual 5G/fast WiFi not detectable
      const networkLabel = sys.connection_type === '4g+' || sys.connection_type === '4g' 
        ? `${sys.connection_type} (or faster)` 
        : sys.connection_type;
      hardwareState.push(`Network: ${networkLabel}`);
    }
    // Battery: battery_level is already 0-100, don't multiply again!
    if (sys.battery_level != null) hardwareState.push(`Battery: ${Math.round(sys.battery_level)}%`);
    if (sys.memory_pressure) hardwareState.push(`Memory: ${sys.memory_pressure}`);
    if (sys.system_constraint) hardwareState.push(`Constraint: ${sys.system_constraint}`);
  }
  
  // Browser state
  if (deepContext.browser) {
    const totalTabs = deepContext.browser.openTabs || 0;
    const nonAiTabs = deepContext.browser.relevantTabs?.length || 0;
    hardwareState.push(`Total Browser Tabs: ${totalTabs} (${nonAiTabs} non-AI tabs)`);
    hardwareState.push(`Current Focus: ${deepContext.focus || 'general'}`);
  }
  
  if (hardwareState.length > 0) {
    sections.push({
      tag: 'hardware_state',
      content: hardwareState.join('\n')
    });
  }
  
  // =========================================================================
  // BEHAVIORAL STATE SECTION
  // =========================================================================
  const behavioralContent = [];
  
  if (behavioralState) {
    behavioralContent.push(`Level: ${behavioralState.level}`);
    if (behavioralState.priority !== 'standard') {
      behavioralContent.push(`Priority: ${behavioralState.priority}`);
    }
    if (behavioralState.modes?.length > 0) {
      behavioralContent.push(`Modes: ${behavioralState.modes.join(', ')}`);
    }
    if (behavioralState.reason) {
      behavioralContent.push(`Reason: ${behavioralState.reason}`);
    }
  }
  
  // Reading mode and cognitive load
  if (telemetry?.readingMode) {
    behavioralContent.push(`Reading Mode: ${telemetry.readingMode}`);
  }
  if (telemetry?.cognitiveLoad) {
    behavioralContent.push(`Cognitive Load: ${telemetry.cognitiveLoad}`);
  }
  
  // Inferred intent
  if (reality?.synthesis?.userIntent) {
    behavioralContent.push(`User Intent: ${reality.synthesis.userIntent}`);
  }
  
  if (behavioralContent.length > 0) {
    sections.push({
      tag: 'behavioral_state',
      content: behavioralContent.join('\n')
    });
  }
  
  // =========================================================================
  // SYSTEM INSTRUCTIONS SECTION (for LLM)
  // =========================================================================
  if (behavioralState?.systemInstructions?.length > 0) {
    sections.push({
      tag: 'system_instructions',
      content: behavioralState.systemInstructions.map((s, i) => `${i + 1}. ${s}`).join('\n')
    });
  }
  
  // =========================================================================
  // KNOWLEDGE CONTEXT SECTION
  // =========================================================================
  const knowledgeContent = [];
  
  // User profile
  if (deepContext.userProfile) {
    const profile = deepContext.userProfile;
    if (profile.currentProject) {
      knowledgeContent.push(`Current Project: ${profile.currentProject}`);
    }
    if (profile.techStack?.length > 0) {
      knowledgeContent.push(`Tech Stack: ${profile.techStack.join(', ')}`);
    }
    if (profile.customContext) {
      knowledgeContent.push(`User Note: ${profile.customContext}`);
    }
  }
  
  // Synthesized topics
  if (reality?.synthesis?.topTopics?.length > 0) {
    knowledgeContent.push(`Active Topics: ${reality.synthesis.topTopics.join(', ')}`);
  }
  if (reality?.synthesis?.dominantLanguage) {
    knowledgeContent.push(`Primary Language: ${reality.synthesis.dominantLanguage}`);
  }
  
  // Cross-tab research
  if (globalRealityMap.researchThreads?.length > 0) {
    const threads = globalRealityMap.researchThreads.slice(0, 3)
      .map(t => t.topic).join(', ');
    knowledgeContent.push(`Research Threads: ${threads}`);
  }
  
  // Relevant tab titles - MORE EXPLICIT
  if (deepContext.browser?.relevantTabs?.length > 0) {
    const tabList = deepContext.browser.relevantTabs.slice(0, 5);
    knowledgeContent.push(`Open Browser Tabs (${tabList.length} non-AI tabs):`);
    tabList.forEach((title, i) => {
      knowledgeContent.push(`  ${i + 1}. ${title}`);
    });
  } else {
    knowledgeContent.push(`Open Browser Tabs: Only AI chat tabs open`);
  }
  
  if (knowledgeContent.length > 0) {
    sections.push({
      tag: 'knowledge_context',
      content: knowledgeContent.join('\n')
    });
  }
  
  // =========================================================================
  // ACTIVE SELECTION SECTION
  // =========================================================================
  if (reality?.primary) {
    const sel = reality.primary;
    const selectionContent = [];
    
    selectionContent.push(`Relevance Score: ${Math.round(sel._relevanceScore || 0)}/100`);
    selectionContent.push(`Type: ${sel.analysis?.type || 'text'}`);
    selectionContent.push(`Action: ${sel.type === 'copy' ? 'Copied' : 'Selected'}`);
    
    if (sel.structured?.language) {
      selectionContent.push(`Language: ${sel.structured.language}`);
    }
    
    // Include the actual content
    const contentSnippet = sel.text?.substring(0, 500) || '';
    if (contentSnippet) {
      selectionContent.push(`Content:\n${contentSnippet}${sel.text?.length > 500 ? '...' : ''}`);
    }
    
    sections.push({
      tag: 'active_selection',
      content: selectionContent.join('\n')
    });
  }
  
  // =========================================================================
  // PAGE CONTEXT SECTION
  // =========================================================================
  if (deepContext.pageContent) {
    const page = deepContext.pageContent;
    const pageContent = [];
    
    pageContent.push(`Type: ${page.type || 'webpage'}`);
    if (page.title || page.problemTitle || page.questionTitle) {
      pageContent.push(`Title: ${page.title || page.problemTitle || page.questionTitle}`);
    }
    if (page.difficulty) pageContent.push(`Difficulty: ${page.difficulty}`);
    if (page.topics?.length > 0) pageContent.push(`Topics: ${page.topics.join(', ')}`);
    if (page.tags?.length > 0) pageContent.push(`Tags: ${page.tags.join(', ')}`);
    
    sections.push({
      tag: 'page_context',
      content: pageContent.join('\n')
    });
  }
  
  // =========================================================================
  // SONIC BRIDGE SECTION - Live Captions from YouTube/Google Meet
  // Supports "pause and ask" workflow - shows current caption prominently
  // =========================================================================
  if (deepContext.sonicBridge && deepContext.sonicBridge.captionCount > 0) {
    const bridge = deepContext.sonicBridge;
    const sonicContent = [];
    
    sonicContent.push(`Platform: ${bridge.platform}`);
    
    // Show the CURRENT caption prominently (what user likely paused on)
    if (bridge.currentCaption) {
      const current = bridge.currentCaption;
      const ageLabel = current.ageMs < 60000 
        ? `${Math.round(current.ageMs / 1000)}s ago` 
        : `${Math.round(current.ageMs / 60000)}m ago`;
      const speaker = current.speaker ? `[${current.speaker}] ` : '';
      sonicContent.push(`CURRENT (paused on): ${speaker}"${current.text}" (${ageLabel})`);
    }
    
    // Show recent captions for context
    sonicContent.push(`Recent Captions (${bridge.captionCount} total):`);
    bridge.recentCaptions.forEach(caption => {
      const speaker = caption.speaker ? `[${caption.speaker}] ` : '';
      sonicContent.push(`  ${speaker}${caption.text} (${caption.timeAgo})`);
    });
    
    sections.push({
      tag: 'video_captions',
      content: sonicContent.join('\n')
    });
  }
  
  // =========================================================================
  // RICH TAB CONTEXT SECTION - Active Resources
  // =========================================================================
  if (deepContext.richTabContext) {
    sections.push({
      tag: 'active_resources',
      content: deepContext.richTabContext
    });
  }
  
  // =========================================================================
  // TEMPORAL CONTEXT SECTION - Recent History Summary
  // =========================================================================
  if (deepContext.historySummary) {
    sections.push({
      tag: 'recent_activity',
      content: deepContext.historySummary
    });
  }
  
  return sections;
}

/**
 * Format sections as XML-style multimodal wrapper
 */
function formatAsXmlWrapper(sections) {
  const xmlParts = sections.map(section => 
    `<${section.tag}>\n${section.content}\n</${section.tag}>`
  );
  
  return `<reality_context version="2.0">\n${xmlParts.join('\n\n')}\n</reality_context>`;
}

/**
 * Format sections as flat context string (legacy format)
 */
function formatAsFlatContext(sections) {
  return sections.map(section => {
    const header = section.tag.replace(/_/g, ' ').toUpperCase();
    return `[${header}]\n${section.content}`;
  }).join('\n\n');
}

/**
 * Get injection format with multimodal context wrapper
 */
function getInjectionFormat(platform, contextString, deepContext = null) {
  // If we have deep context, build multimodal wrapper
  let formattedContext = contextString;
  
  if (deepContext) {
    const sections = buildMultimodalContextWrapper(deepContext);
    
    // Choose format based on platform's parsing capabilities
    if (platform === 'claude' || platform === 'chatgpt' || platform === 'gemini') {
      formattedContext = formatAsXmlWrapper(sections);
    } else {
      formattedContext = formatAsFlatContext(sections);
    }
  }
  
  // Platform-specific wrapping
  const formats = {
    chatgpt: {
      style: 'xml',
      formatted: `${formattedContext}\n\n`,
    },
    claude: {
      style: 'xml',
      formatted: `${formattedContext}\n\n`,
    },
    gemini: {
      style: 'xml',
      formatted: `${formattedContext}\n\n`,
    },
    perplexity: {
      style: 'xml',
      formatted: `${formattedContext}\n\n`,
    },
    poe: {
      style: 'flat',
      formatted: `[User Reality Context]\n${formattedContext}\n\n`,
    },
    huggingchat: {
      style: 'system',
      formatted: `System: User reality context:\n${formattedContext}\n\n`,
    },
    ollama: {
      style: 'system',
      formatted: `[System Reality Context]\n${formattedContext}\n\n`,
    },
    lmstudio: {
      style: 'system',
      formatted: `### Reality Context\n${formattedContext}\n\n### User\n`,
    },
    default: {
      style: 'xml',
      formatted: `${formattedContext}\n\n`,
    },
  };
  
  return formats[platform] || formats.default;
}

function shouldInjectContext(prompt, settings) {
  if (!settings.autoDetect) return true;
  
  const promptLower = prompt.toLowerCase();
  
  // Keywords that suggest time/date context would be helpful
  const temporalKeywords = [
    'today', 'tomorrow', 'yesterday', 'now', 'current', 'time',
    'morning', 'afternoon', 'evening', 'night', 'weekend',
    'schedule', 'meeting', 'appointment', 'deadline', 'date',
    'when', 'what day', 'what time', 'this week', 'next week',
    'hour', 'minute', 'later', 'soon', 'early', 'late',
  ];
  
  // Keywords that suggest location context would be helpful
  const spatialKeywords = [
    'here', 'nearby', 'local', 'around', 'close',
    'weather', 'temperature', 'restaurant', 'store',
    'where', 'location', 'city', 'country', 'area',
  ];
  
  const hasTemporal = temporalKeywords.some(kw => promptLower.includes(kw));
  const hasSpatial = spatialKeywords.some(kw => promptLower.includes(kw));
  
  return hasTemporal || hasSpatial;
}


// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    'GET_CONTEXT': () => handleGetContext(message, sendResponse),
    'GET_SETTINGS': () => handleGetSettings(sendResponse),
    'UPDATE_SETTINGS': () => handleUpdateSettings(message.settings, sendResponse),
    'CHECK_SERVER': () => handleCheckServer(message.serverUrl, sendResponse),
    'GET_STATS': () => handleGetStats(sendResponse),
    'RESET_STATS': () => handleResetStats(sendResponse),
    'AUGMENT_PROMPT': () => handleAugmentPrompt(message, sendResponse),
    // Killer features handlers
    'SELECTION_CAPTURED': () => {
      handleSelectionCapture(message.payload);
      sendResponse({ success: true });
    },
    // v3.0: Context Pivot handler
    'CONTEXT_PIVOT': () => {
      handleContextPivot(message.payload);
      sendResponse({ success: true, contextStale: true });
    },
    // v4.0: Frustration Detection handler
    'FRUSTRATION_DETECTED': () => {
      handleFrustrationDetected(message.payload);
      sendResponse({ success: true, frustrationAcknowledged: true });
    },
    'SET_USER_PROFILE': () => {
      if (message.currentProject) setCurrentProject(message.currentProject);
      if (message.customContext) setUserCustomContext(message.customContext);
      if (message.techStack) {
        userProfile.techStack = message.techStack;
        saveUserProfile();
      }
      // v4.6 Task Context (HIGH VALUE - per ChatGPT feedback)
      if (message.taskContext) {
        userProfile.taskContext = {
          goal: message.taskContext.goal || '',
          currentStep: message.taskContext.currentStep || '',
          successCriteria: message.taskContext.successCriteria || '',
          nonGoals: message.taskContext.nonGoals || '',
        };
        saveUserProfile();
        console.log('RAL v4.6: Task context updated:', userProfile.taskContext);
      }
      sendResponse({ success: true, userProfile });
    },
    'GET_USER_PROFILE': () => {
      sendResponse(userProfile);
    },
    'GET_SELECTION_HISTORY': () => {
      sendResponse(selectionHistory);
    },
    // v3.0: Telemetry handler
    'GET_TELEMETRY': () => {
      const latestSelection = selectionHistory[0];
      sendResponse({
        telemetry: latestSelection?.telemetry || {},
        contextPivot: lastContextPivot,
        contextStale: contextStale,
      });
    },
    
    // =========================================================================
    // v2.0: CROSS-TAB TRUTH ARBITER - Research Update Handler
    // =========================================================================
    'RESEARCH_UPDATE': () => {
      handleResearchUpdate(message.payload, sender.tab?.id);
      sendResponse({ success: true, globalReality: getGlobalRealitySummary() });
    },
    
    // v3.0: Get Global Reality Map for Reality Arbiter
    // This is the CRITICAL endpoint for cross-tab context synchronization
    'GET_GLOBAL_REALITY': () => {
      const requestingTabId = sender.tab?.id;
      const preparedReality = prepareRealityMapForArbiter(requestingTabId);
      sendResponse({
        success: true,
        globalRealityMap: preparedReality,
        primaryContext: globalRealityMap.primaryContext,
        researchThreads: globalRealityMap.researchThreads,
        activeTabCount: globalRealityMap.activeTabs.size,
        telemetry: realityTelemetry
      });
    },
    
    // v3.0: Update thread reality from content script
    'UPDATE_THREAD_REALITY': () => {
      const threadId = message.threadId || sender.tab?.id?.toString() || `thread_${Date.now()}`;
      updateThreadReality(threadId, message.payload);
      sendResponse({ success: true, threadId });
    },
    
    // Tab context update
    'TAB_CONTEXT_UPDATE': () => {
      updateTabContext(sender.tab?.id, message.payload);
      sendResponse({ success: true });
    },
    
    // =========================================================================
    // NEW FEATURES: Rich Tab Context, History Summary, Sonic Bridge
    // =========================================================================
    
    // Feature: "Rich Tab Context" - Get active resources
    'GET_RICH_TAB_CONTEXT': async () => {
      const richTabContext = await getRichTabContext();
      sendResponse({ success: true, richTabContext });
    },
    
    // Feature: "Temporal Context" / History Summary
    'GET_HISTORY_SUMMARY': async () => {
      const historySummary = await getHistorySummary();
      sendResponse({ success: true, historySummary });
    },
    
    // Feature: "Sonic Bridge" - Get video captions
    'GET_SONIC_BRIDGE_CAPTIONS': async () => {
      const captions = await getSonicBridgeCaptions();
      sendResponse({ success: true, captions });
    },
    
    // Get all new context features at once
    'GET_ENHANCED_CONTEXT': async () => {
      const [richTabContext, historySummary, sonicBridgeCaptions] = await Promise.all([
        getRichTabContext(),
        getHistorySummary(),
        getSonicBridgeCaptions()
      ]);
      
      sendResponse({
        success: true,
        richTabContext,
        historySummary,
        sonicBridgeCaptions
      });
    },
  };
  
  const handler = handlers[message.type];
  if (handler) {
    handler();
    return true; // Async response
  }
});

async function handleGetContext(message, sendResponse) {
  try {
    const settings = await getSettingsFromStorage();
    console.log('RAL SW: Got settings', settings);
    
    if (!settings.enabled) {
      console.log('RAL SW: Context disabled in settings');
      sendResponse({ enabled: false });
      return;
    }
    
    // Check cache (shorter cache for fresher context)
    const now = Date.now();
    if (contextCache.data && (now - contextCache.timestamp) < settings.cacheTimeout) {
      const contextString = formatContextString(contextCache.data, settings);
      console.log('RAL SW: Using cached context');
      sendResponse({
        enabled: true,
        context: contextCache.data,
        contextString: contextString,
        injection: getInjectionFormat(message.platform, contextString),
        cached: true,
      });
      return;
    }
    
    // Generate DEEP context (includes browser intelligence)
    console.log('RAL SW: Generating deep context...');
    const deepContext = await generateDeepContext(settings);
    console.log('RAL SW: Deep context generated', deepContext);
    
    // Add synthesized reality to deep context
    deepContext.synthesizedReality = synthesizeActiveReality();
    deepContext.globalReality = getGlobalRealitySummary();
    
    // Update cache
    contextCache = {
      data: deepContext,
      timestamp: now,
    };
    
    const contextString = formatContextString(deepContext, settings);
    console.log('RAL SW: Formatted context string:', contextString);
    
    // Try server enhancement in hybrid/server mode
    let serverContext = null;
    if ((settings.mode === 'server' || settings.mode === 'hybrid') && settings.serverUrl) {
      serverContext = await fetchServerContext(settings, message.prompt || '', message.platform);
    }
    
    // Update stats
    const newStats = {
      promptsEnhanced: (settings.promptsEnhanced || 0) + 1,
      lastUsed: new Date().toISOString(),
    };
    await chrome.storage.local.set(newStats);
    
    // Use multimodal injection format with deep context
    const injection = serverContext 
      ? getInjectionFormat(message.platform, serverContext.system_context)
      : getInjectionFormat(message.platform, contextString, deepContext);
    
    // v3.0: Update Thread Reality for cross-tab synchronization
    const threadId = message.threadId || `thread_${Date.now()}`;
    updateThreadReality(threadId, {
      synthesis: deepContext.synthesizedReality?.synthesis,
      context: deepContext,
      timestamp: Date.now()
    });
    
    sendResponse({
      enabled: true,
      context: deepContext,
      contextString: serverContext?.system_context || contextString,
      injection: injection,
      serverEnhanced: !!serverContext,
      cached: false,
      // v3.0: Enhanced synthesis metadata for Reality Arbiter
      synthesis: {
        confidence: deepContext.synthesizedReality?.confidence,
        userIntent: deepContext.synthesizedReality?.synthesis?.userIntent,
        primaryLanguage: deepContext.synthesizedReality?.synthesis?.dominantLanguage,
      },
      threadId: threadId
    });
  } catch (error) {
    console.error('RAL: Error generating context', error);
    sendResponse({ enabled: false, error: error.message });
  }
}

async function handleAugmentPrompt(message, sendResponse) {
  try {
    const settings = await getSettingsFromStorage();
    
    if (!settings.enabled) {
      sendResponse({ augmented: false, originalPrompt: message.prompt });
      return;
    }
    
    // Check if context should be injected
    if (!shouldInjectContext(message.prompt, settings)) {
      sendResponse({ augmented: false, originalPrompt: message.prompt });
      return;
    }
    
    const localContext = generateLocalContext();
    const contextString = formatContextString(localContext, settings);
    const injection = getInjectionFormat(message.platform, contextString);
    
    sendResponse({
      augmented: true,
      originalPrompt: message.prompt,
      augmentedPrompt: injection.formatted + message.prompt,
      contextUsed: contextString,
    });
  } catch (error) {
    sendResponse({ augmented: false, error: error.message });
  }
}

async function handleGetSettings(sendResponse) {
  const settings = await getSettingsFromStorage();
  sendResponse(settings);
}

async function handleUpdateSettings(newSettings, sendResponse) {
  const { settings: current } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ 
    settings: { ...current, ...newSettings } 
  });
  sendResponse({ success: true });
}

async function handleCheckServer(serverUrl, sendResponse) {
  const health = await checkServerHealth(serverUrl);
  sendResponse(health);
}

async function handleGetStats(sendResponse) {
  const settings = await getSettingsFromStorage();
  sendResponse({
    promptsEnhanced: settings.promptsEnhanced || 0,
    lastUsed: settings.lastUsed,
    mode: settings.mode || 'local',
    serverConfigured: !!settings.serverUrl,
    selectionsTracked: selectionHistory.length,
    userProfileSet: !!userProfile.currentProject || userProfile.techStack.length > 0,
  });
}

async function handleResetStats(sendResponse) {
  const settings = await getSettingsFromStorage();
  // Save both formats for compatibility
  await chrome.storage.local.set({
    settings: { ...settings, promptsEnhanced: 0, lastUsed: null },
    promptsEnhanced: 0,
    lastUsed: null
  });
  sendResponse({ success: true });
}


// ============================================================================
// CROSS-TAB TRUTH ARBITER - Core Functions
// ============================================================================

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *                         CROSS-TAB TRUTH ARBITER
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Maintains a Global Reality Map and resolves conflicts between tabs.
 * Uses Interaction Telemetry to determine the "primary truth".
 */

/**
 * Handle RESEARCH_UPDATE events from selection tracker
 * Updates Global Reality Map with cross-tab context
 */
function handleResearchUpdate(payload, tabId) {
  const { topic, topics, language, domain, telemetry, threadId } = payload;
  
  // 1. Update active tabs map
  if (tabId) {
    globalRealityMap.activeTabs.set(tabId, {
      domain: domain,
      language: language,
      topics: topics || [topic].filter(Boolean),
      telemetry: telemetry || {},
      lastUpdate: Date.now(),
      interactionScore: calculateInteractionScore(telemetry),
    });
  }
  
  // 2. Update research threads
  const allTopics = [topic, ...(topics || [])].filter(Boolean);
  allTopics.forEach(t => {
    const normalizedTopic = t.toLowerCase().trim();
    
    const existingThread = globalRealityMap.researchThreads.find(
      thread => thread.topic === normalizedTopic
    );
    
    if (existingThread) {
      existingThread.count++;
      existingThread.lastSeen = Date.now();
      if (tabId && !existingThread.tabIds.includes(tabId)) {
        existingThread.tabIds.push(tabId);
      }
    } else {
      globalRealityMap.researchThreads.push({
        topic: normalizedTopic,
        count: 1,
        tabIds: tabId ? [tabId] : [],
        lastSeen: Date.now(),
      });
    }
    
    // Update topic frequency
    globalRealityMap.topicFrequency[normalizedTopic] = 
      (globalRealityMap.topicFrequency[normalizedTopic] || 0) + 1;
  });
  
  // 3. Resolve primary context (conflict resolution)
  resolvePrimaryContext();
  
  // 4. Update user profile with research activity
  updateUserProfile({
    topics: allTopics,
    domain: domain,
    analysis: { type: language ? 'code' : 'text' },
    structured: { language: language }
  });
  
  // 5. Cleanup old threads
  cleanupOldResearchThreads();
  
  console.log(`RAL v2: RESEARCH_UPDATE from tab ${tabId}`,
              `| Topic: ${topic}`,
              `| Threads: ${globalRealityMap.researchThreads.length}`);
}

/**
 * Calculate interaction score from telemetry
 * Higher score = more confident this tab represents user's focus
 */
function calculateInteractionScore(telemetry) {
  if (!telemetry) return 0;
  
  let score = 0;
  
  // Recent activity boost
  if (telemetry.lastInteraction) {
    const age = Date.now() - telemetry.lastInteraction;
    score += Math.max(0, 50 - (age / 1000)); // Up to 50 points for very recent
  }
  
  // Selection/copy activity
  if (telemetry.selectionCount) score += Math.min(20, telemetry.selectionCount * 5);
  if (telemetry.copyCount) score += Math.min(30, telemetry.copyCount * 10);
  
  // Reading mode signals engagement
  if (telemetry.readingMode === 'deep_study') score += 25;
  if (telemetry.readingMode === 'quick_troubleshooting') score += 15;
  
  // Scroll depth indicates page engagement
  if (telemetry.scrollDepth) score += telemetry.scrollDepth * 10;
  
  return score;
}

/**
 * Resolve primary context from conflicting tabs
 * Uses interaction telemetry as the arbiter
 */
function resolvePrimaryContext() {
  if (globalRealityMap.activeTabs.size === 0) {
    globalRealityMap.primaryContext = null;
    return;
  }
  
  // Find tab with highest interaction score
  let highestScore = -1;
  let primaryTabId = null;
  let primaryData = null;
  
  for (const [tabId, data] of globalRealityMap.activeTabs.entries()) {
    if (data.interactionScore > highestScore) {
      highestScore = data.interactionScore;
      primaryTabId = tabId;
      primaryData = data;
    }
  }
  
  // Check for conflicts (multiple tabs claiming different languages/contexts)
  const conflicts = detectContextConflicts();
  
  globalRealityMap.primaryContext = {
    tabId: primaryTabId,
    domain: primaryData?.domain,
    language: primaryData?.language,
    topics: primaryData?.topics || [],
    confidence: highestScore > 50 ? 'HIGH' : highestScore > 20 ? 'MEDIUM' : 'LOW',
    conflicts: conflicts,
    resolvedAt: Date.now(),
  };
  
  globalRealityMap.lastResolution = Date.now();
  
  if (conflicts.length > 0) {
    console.log(`RAL v2: Resolved context conflict. Primary: ${primaryData?.language || 'unknown'}`,
                `| Conflicts: ${conflicts.map(c => c.language).join(', ')}`);
  }
}

/**
 * Detect conflicts between tabs (e.g., Python vs JavaScript)
 */
function detectContextConflicts() {
  const conflicts = [];
  const languageTabs = new Map(); // language -> [tabIds]
  
  for (const [tabId, data] of globalRealityMap.activeTabs.entries()) {
    if (data.language) {
      if (!languageTabs.has(data.language)) {
        languageTabs.set(data.language, []);
      }
      languageTabs.get(data.language).push({ tabId, score: data.interactionScore });
    }
  }
  
  // If multiple languages, record as conflicts
  if (languageTabs.size > 1) {
    for (const [language, tabs] of languageTabs.entries()) {
      conflicts.push({
        language,
        tabCount: tabs.length,
        maxScore: Math.max(...tabs.map(t => t.score)),
      });
    }
  }
  
  return conflicts;
}

/**
 * Update context for a specific tab
 */
function updateTabContext(tabId, payload) {
  if (!tabId) return;
  
  const { domain, language, topics, telemetry } = payload;
  
  globalRealityMap.activeTabs.set(tabId, {
    domain: domain,
    language: language,
    topics: topics || [],
    telemetry: telemetry || {},
    lastUpdate: Date.now(),
    interactionScore: calculateInteractionScore(telemetry),
  });
  
  // Re-resolve if this might change primary context
  resolvePrimaryContext();
}

/**
 * Get a summary of the Global Reality Map
 */
function getGlobalRealitySummary() {
  return {
    activeTabs: globalRealityMap.activeTabs.size,
    primaryContext: globalRealityMap.primaryContext,
    researchThreads: globalRealityMap.researchThreads.slice(0, 10),
    topTopics: Object.entries(globalRealityMap.topicFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count })),
    lastResolution: globalRealityMap.lastResolution,
  };
}

/**
 * Cleanup old research threads (older than 30 minutes)
 */
function cleanupOldResearchThreads() {
  const thirtyMinutesAgo = Date.now() - 1800000;
  globalRealityMap.researchThreads = globalRealityMap.researchThreads
    .filter(thread => thread.lastSeen > thirtyMinutesAgo);
  
  // Cleanup stale tab entries (no update in 10 minutes)
  const tenMinutesAgo = Date.now() - 600000;
  for (const [tabId, data] of globalRealityMap.activeTabs.entries()) {
    if (data.lastUpdate < tenMinutesAgo) {
      globalRealityMap.activeTabs.delete(tabId);
    }
  }
}

// ============================================================================
// FEATURE: "Rich Tab Context" - Active resources the user is using
// ============================================================================

/**
 * Excluded domains for Rich Tab Context
 * These are AI chat sites and localhost that should be filtered out
 */
const RICH_TAB_EXCLUDED_DOMAINS = [
  'chatgpt.com',
  'chat.openai.com',
  'claude.ai',
  'gemini.google.com',
  'bard.google.com',
  'perplexity.ai',
  'poe.com',
  'huggingface.co',
  'localhost',
  '127.0.0.1',
];

/**
 * Clean URL by stripping tracking parameters
 * Removes ?utm_*, ?ref, ?source, etc.
 */
function cleanUrl(url) {
  try {
    const urlObj = new URL(url);
    const paramsToRemove = [];
    
    // Find tracking parameters to remove
    for (const [key] of urlObj.searchParams) {
      if (key.startsWith('utm_') || 
          key === 'ref' || 
          key === 'source' ||
          key === 'fbclid' ||
          key === 'gclid' ||
          key === 'mc_cid' ||
          key === 'mc_eid') {
        paramsToRemove.push(key);
      }
    }
    
    // Remove the tracking parameters
    paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
    
    return urlObj.toString();
  } catch (e) {
    return url;
  }
}

/**
 * Check if a URL should be excluded from Rich Tab Context
 */
function isExcludedDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return RICH_TAB_EXCLUDED_DOMAINS.some(domain => hostname.includes(domain));
  } catch (e) {
    return true; // Exclude invalid URLs
  }
}

/**
 * Feature: "Rich Tab Context"
 * Returns a Markdown-formatted list of top 5 active resources the user is using
 * 
 * @returns {Promise<string>} Markdown string of active tabs
 */
async function getRichTabContext() {
  try {
    // Get all tabs
    const allTabs = await chrome.tabs.query({});
    
    // Get the current active tab to exclude it
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTabId = activeTab?.id;
    
    // Filter and process tabs
    const filteredTabs = allTabs
      .filter(tab => {
        // Exclude the current active tab
        if (tab.id === activeTabId) return false;
        
        // Exclude tabs without URLs
        if (!tab.url) return false;
        
        // Exclude chrome:// and extension pages
        if (tab.url.startsWith('chrome://') || 
            tab.url.startsWith('chrome-extension://') ||
            tab.url.startsWith('about:')) {
          return false;
        }
        
        // Exclude AI chat sites and localhost
        if (isExcludedDomain(tab.url)) return false;
        
        return true;
      })
      .map(tab => ({
        title: tab.title || 'Untitled',
        url: cleanUrl(tab.url),
        lastAccessed: tab.lastAccessed || 0,
        id: tab.id
      }))
      // Sort by lastAccessed (most recent first)
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      // Take top 5
      .slice(0, 5);
    
    // If no tabs, return empty message
    if (filteredTabs.length === 0) {
      return 'No other active resources detected.';
    }
    
    // Format as Markdown numbered list
    const markdownList = filteredTabs
      .map((tab, index) => {
        // Truncate long titles
        const title = tab.title.length > 60 
          ? tab.title.substring(0, 57) + '...' 
          : tab.title;
        return `${index + 1}. [${title}](${tab.url})`;
      })
      .join('\n');
    
    return markdownList;
  } catch (error) {
    console.error('RAL: Error getting rich tab context:', error);
    return 'Unable to retrieve tab context.';
  }
}

// ============================================================================
// FEATURE: "Temporal Context" - History summary from the past hour
// ============================================================================

/**
 * Feature: "Temporal Context" / History Summary
 * Returns a summary of user activity from the past hour, grouped by domain
 * 
 * @returns {Promise<string>} Summary string like "StackOverflow (4 visits), GitHub (2 visits)"
 */
async function getHistorySummary() {
  try {
    // Calculate 1 hour ago
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    // Search history from the past hour
    const historyItems = await chrome.history.search({
      text: '',           // Empty string matches all
      startTime: oneHourAgo,
      maxResults: 100     // Get enough results to summarize
    });
    
    // Group by domain and count visits
    const domainCounts = {};
    
    for (const item of historyItems) {
      if (!item.url) continue;
      
      try {
        const urlObj = new URL(item.url);
        const hostname = urlObj.hostname;
        
        // Skip chrome:// pages, extensions, and empty hostnames
        if (hostname.startsWith('chrome') || 
            hostname.includes('extension') ||
            hostname === '' ||
            hostname === 'newtab') {
          continue;
        }
        
        // Skip excluded domains (AI sites, localhost)
        if (isExcludedDomain(item.url)) continue;
        
        // Clean up domain name for display
        let displayName = hostname
          .replace('www.', '')
          .replace('.com', '')
          .replace('.org', '')
          .replace('.io', '')
          .replace('.dev', '');
        
        // Capitalize first letter
        displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
        
        // Special cases for known domains
        const domainMappings = {
          'stackoverflow': 'StackOverflow',
          'github': 'GitHub',
          'gitlab': 'GitLab',
          'youtube': 'YouTube',
          'reddit': 'Reddit',
          'twitter': 'Twitter',
          'x': 'Twitter/X',
          'linkedin': 'LinkedIn',
          'medium': 'Medium',
          'dev': 'Dev.to',
          'hashnode': 'Hashnode',
          'google': 'Google',
          'docs.google': 'Google Docs',
          'drive.google': 'Google Drive',
          'mail.google': 'Gmail',
          'notion': 'Notion',
          'figma': 'Figma',
          'slack': 'Slack',
          'discord': 'Discord',
          'npmjs': 'npm',
          'pypi': 'PyPI',
          'crates': 'crates.io'
        };
        
        // Check if we have a mapping
        for (const [key, value] of Object.entries(domainMappings)) {
          if (hostname.includes(key)) {
            displayName = value;
            break;
          }
        }
        
        // Count visits
        domainCounts[displayName] = (domainCounts[displayName] || 0) + 1;
        
      } catch (e) {
        // Skip invalid URLs
        continue;
      }
    }
    
    // Sort by visit count (descending) and format
    const sortedDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10 domains
    
    // If no history, return appropriate message
    if (sortedDomains.length === 0) {
      return 'No browsing activity in the past hour.';
    }
    
    // Format as "Domain (X visits)" string
    const summary = sortedDomains
      .map(([domain, count]) => `${domain} (${count} visit${count !== 1 ? 's' : ''})`)
      .join(', ');
    
    return summary;
  } catch (error) {
    console.error('RAL: Error getting history summary:', error);
    return 'Unable to retrieve browsing history.';
  }
}

// ============================================================================
// FEATURE: Get Sonic Bridge Captions from active tab
// ============================================================================

/**
 * Get captions from the Sonic Bridge content script
 * Searches ALL open video platform tabs, not just the active one
 * Auto-injects content script if not already loaded
 * @returns {Promise<object|null>} Caption data or null
 */
async function getSonicBridgeCaptions() {
  console.log('RAL Sonic Bridge: getSonicBridgeCaptions() called');
  
  try {
    // Query ALL tabs on video platforms (not just active tab)
    const videoPlatforms = ['youtube.com', 'youtu.be', 'meet.google.com'];
    const allTabs = await chrome.tabs.query({});
    
    console.log(`RAL Sonic Bridge: Found ${allTabs.length} total tabs`);
    
    const videoTabs = allTabs.filter(tab => 
      tab.url && videoPlatforms.some(p => tab.url.includes(p))
    );
    
    if (videoTabs.length === 0) {
      console.log('RAL Sonic Bridge: No video platform tabs found');
      return null;
    }
    
    console.log(`RAL Sonic Bridge: Found ${videoTabs.length} video tab(s):`, videoTabs.map(t => t.url));
    
    // Try to get captions from each video tab
    for (const tab of videoTabs) {
      try {
        console.log(`RAL Sonic Bridge: Sending message to tab ${tab.id} (${tab.url})`);
        
        // Use Promise with timeout to avoid hanging
        const response = await Promise.race([
          chrome.tabs.sendMessage(tab.id, { type: 'GET_SONIC_BRIDGE_CAPTIONS' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
        
        console.log(`RAL Sonic Bridge: Response from tab ${tab.id}:`, response);
        
        // Response structure: { success: true, captions: { platform, captionCount, durationMs, text, rawCaptions } }
        if (response?.success && response?.captions) {
          const captions = response.captions;
          if (captions.rawCaptions && captions.rawCaptions.length > 0) {
            console.log(`RAL Sonic Bridge: SUCCESS! Got ${captions.captionCount} captions from ${tab.url}`);
            return captions; // Return the captions object directly
          } else {
            console.log(`RAL Sonic Bridge: Tab ${tab.id} has empty caption buffer`);
          }
        } else {
          console.log(`RAL Sonic Bridge: Tab ${tab.id} returned invalid response:`, response);
        }
      } catch (e) {
        // Content script not loaded - try to inject it
        console.log(`RAL Sonic Bridge: Could not reach tab ${tab.id}: ${e.message}, attempting to inject script...`);
        
        try {
          // Inject the content script
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content-scripts/sonic-bridge.js']
          });
          console.log(`RAL Sonic Bridge: Injected script into tab ${tab.id}, waiting for init...`);
          
          // Wait a moment for the script to initialize
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Try again
          const retryResponse = await Promise.race([
            chrome.tabs.sendMessage(tab.id, { type: 'GET_SONIC_BRIDGE_CAPTIONS' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
          ]);
          
          if (retryResponse?.success && retryResponse?.captions?.rawCaptions?.length > 0) {
            console.log(`RAL Sonic Bridge: SUCCESS after injection! Got ${retryResponse.captions.captionCount} captions`);
            return retryResponse.captions;
          } else {
            console.log(`RAL Sonic Bridge: Script injected but no captions yet (buffer may be empty)`);
          }
        } catch (injectError) {
          console.log(`RAL Sonic Bridge: Could not inject script into tab ${tab.id}:`, injectError.message);
        }
      }
    }
    
    console.log('RAL Sonic Bridge: No captions found in any video tab');
    return null;
  } catch (e) {
    console.warn('RAL Sonic Bridge: Error getting captions', e);
    return null;
  }
}

/**
 * Handle tab close - remove from Global Reality Map
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  if (globalRealityMap.activeTabs.has(tabId)) {
    globalRealityMap.activeTabs.delete(tabId);
    resolvePrimaryContext();
    console.log(`RAL v2: Tab ${tabId} closed, removed from Reality Map`);
  }
});


// ============================================================================
// STARTUP
// ============================================================================

console.log(`RAL Background Service Worker v${RAL_VERSION} loaded`);

// Load persisted data on startup
(async () => {
  await loadSelectionHistory();
  await loadUserProfile();
  console.log('RAL: Loaded selection history:', selectionHistory.length, 'items');
  console.log('RAL: Loaded user profile:', userProfile);
})();

// Periodic cache cleanup
setInterval(() => {
  if (Date.now() - contextCache.timestamp > 300000) { // 5 minutes
    contextCache = { data: null, serverData: null, timestamp: 0 };
  }
  
  // Clean up old selections (older than 1 hour)
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  selectionHistory = selectionHistory.filter(s => s.timestamp > oneHourAgo);
}, 60000);
