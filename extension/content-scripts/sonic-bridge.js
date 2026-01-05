/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  RAL Sonic Bridge v1.0.0 - Live Caption Capture                           ║
 * ║  Captures captions from YouTube, Google Meet, and other video platforms   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * FEATURE: "The Sonic Bridge"
 * Captures live captions/subtitles from video players and buffers them
 * for context injection into LLMs.
 * 
 * SUPPORTED PLATFORMS:
 * - YouTube (native captions)
 * - Google Meet (live transcription)
 * - Generic caption containers (fallback)
 * 
 * BUFFER MANAGEMENT:
 * - Keeps last 5 minutes of dialogue
 * - Prunes old text based on timestamps
 * - Memory-efficient circular buffer approach
 */

(function() {
  'use strict';
  
  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  const SONIC_CONFIG = {
    // Buffer settings
    MAX_BUFFER_DURATION_MS: 5 * 60 * 1000,  // 5 minutes in milliseconds
    PRUNE_INTERVAL_MS: 30 * 1000,            // Prune every 30 seconds
    MIN_CAPTION_LENGTH: 2,                   // Ignore very short captions
    MAX_BUFFER_ENTRIES: 500,                 // Hard cap on buffer size
    
    // Caption selectors by platform
    // YouTube 2024-2026: Multiple possible selectors as YouTube frequently changes DOM
    SELECTORS: {
      youtube: {
        // Primary caption text elements
        primary: '.ytp-caption-segment',
        // Caption window container
        container: '.caption-window, .ytp-caption-window-container',
        // Caption text spans inside window
        spans: '.captions-text span, .caption-visual-line span',
        // Fallback broad selector
        fallback: '[class*="caption-segment"], [class*="caption-window"] span'
      },
      googleMeet: {
        primary: '.a4cQT',                   // Meet's caption container
        fallback: '[class*="caption"]',
        transcript: '[data-message-text]'    // Meet transcript messages
      },
      generic: {
        captions: '[class*="caption"], [class*="subtitle"], [class*="transcript"]',
        videoText: 'video + div, .video-captions, .subtitles-container'
      }
    },
    
    // Debounce settings
    MUTATION_DEBOUNCE_MS: 100,
    
    // Platform detection
    PLATFORMS: {
      youtube: ['youtube.com', 'youtu.be'],
      googleMeet: ['meet.google.com'],
    }
  };
  
  // ============================================================================
  // STATE
  // ============================================================================
  
  // Caption buffer: Array of { text, timestamp, platform, speaker? }
  let captionBuffer = [];
  
  // Deduplication: Track recent captions to avoid duplicates
  let recentCaptions = new Set();
  const RECENT_CAPTION_TTL = 5000; // 5 seconds
  
  // Observer reference for cleanup
  let captionObserver = null;
  
  // Debounce timer
  let debounceTimer = null;
  
  // Current platform
  let currentPlatform = detectPlatform();
  
  // ============================================================================
  // PLATFORM DETECTION
  // ============================================================================
  
  function detectPlatform() {
    const hostname = window.location.hostname;
    
    for (const [platform, domains] of Object.entries(SONIC_CONFIG.PLATFORMS)) {
      if (domains.some(domain => hostname.includes(domain))) {
        return platform;
      }
    }
    
    return 'generic';
  }
  
  // ============================================================================
  // CAPTION EXTRACTION
  // ============================================================================
  
  /**
   * Extract caption text from a DOM element
   */
  function extractCaptionText(element) {
    if (!element) return null;
    
    // Get text content, clean it up
    let text = element.textContent || element.innerText || '';
    text = text.trim().replace(/\s+/g, ' ');
    
    // Filter out too short or empty captions
    if (text.length < SONIC_CONFIG.MIN_CAPTION_LENGTH) {
      return null;
    }
    
    return text;
  }
  
  /**
   * Extract speaker info if available (Google Meet)
   */
  function extractSpeaker(element) {
    // Google Meet often has speaker name in adjacent/parent elements
    const parent = element.closest('[data-sender-name], [data-participant-id]');
    if (parent) {
      return parent.getAttribute('data-sender-name') || 
             parent.getAttribute('aria-label')?.split(':')[0] || 
             null;
    }
    
    // YouTube doesn't typically show speaker names in captions
    return null;
  }
  
  /**
   * Check if caption is duplicate (deduplication)
   */
  function isDuplicateCaption(text) {
    const normalized = text.toLowerCase().trim();
    
    if (recentCaptions.has(normalized)) {
      return true;
    }
    
    // Add to recent captions with TTL
    recentCaptions.add(normalized);
    setTimeout(() => recentCaptions.delete(normalized), RECENT_CAPTION_TTL);
    
    return false;
  }
  
  /**
   * Add caption to buffer
   * @returns {boolean} true if caption was added, false if duplicate/invalid
   */
  function addCaptionToBuffer(text, speaker = null) {
    if (!text || isDuplicateCaption(text)) {
      return false;
    }
    
    const entry = {
      text: text,
      timestamp: Date.now(),
      platform: currentPlatform,
      speaker: speaker
    };
    
    captionBuffer.push(entry);
    
    // Enforce hard cap
    if (captionBuffer.length > SONIC_CONFIG.MAX_BUFFER_ENTRIES) {
      captionBuffer = captionBuffer.slice(-SONIC_CONFIG.MAX_BUFFER_ENTRIES);
    }
    
    console.log(`RAL Sonic Bridge: Captured "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"${speaker ? ` (${speaker})` : ''}`);
    return true;
  }
  
  // ============================================================================
  // BUFFER MANAGEMENT
  // ============================================================================
  
  /**
   * Prune old captions beyond the 5-minute window
   */
  function pruneOldCaptions() {
    const cutoffTime = Date.now() - SONIC_CONFIG.MAX_BUFFER_DURATION_MS;
    const beforeCount = captionBuffer.length;
    
    captionBuffer = captionBuffer.filter(entry => entry.timestamp > cutoffTime);
    
    const pruned = beforeCount - captionBuffer.length;
    if (pruned > 0) {
      console.log(`RAL Sonic Bridge: Pruned ${pruned} old captions, ${captionBuffer.length} remaining`);
    }
  }
  
  /**
   * Get all buffered captions as formatted text
   * Also captures the CURRENTLY VISIBLE caption (for paused video scenarios)
   */
  function getBufferedCaptions() {
    // CRITICAL: Scan for currently visible captions FIRST
    // This handles the "pause video, switch to ChatGPT" workflow
    scanCurrentlyVisibleCaptions();
    
    if (captionBuffer.length === 0) {
      return null;
    }
    
    // Prune before returning
    pruneOldCaptions();
    
    // Find the most recent caption (likely what user paused on)
    const mostRecentCaption = captionBuffer[captionBuffer.length - 1];
    
    // Format captions with timestamps
    const formatted = captionBuffer.map(entry => {
      const timeAgo = Math.round((Date.now() - entry.timestamp) / 1000);
      const timeLabel = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.round(timeAgo / 60)}m ago`;
      
      if (entry.speaker) {
        return `[${timeLabel}] ${entry.speaker}: ${entry.text}`;
      }
      return `[${timeLabel}] ${entry.text}`;
    });
    
    return {
      platform: currentPlatform,
      captionCount: captionBuffer.length,
      durationMs: captionBuffer.length > 0 
        ? Date.now() - captionBuffer[0].timestamp 
        : 0,
      text: formatted.join('\n'),
      rawCaptions: captionBuffer.slice(), // Copy for advanced processing
      // NEW: Include the current/last caption prominently (what user likely paused on)
      currentCaption: mostRecentCaption ? {
        text: mostRecentCaption.text,
        speaker: mostRecentCaption.speaker,
        timestamp: mostRecentCaption.timestamp,
        ageMs: Date.now() - mostRecentCaption.timestamp
      } : null
    };
  }
  
  /**
   * Scan for CURRENTLY VISIBLE captions on the page
   * This is crucial for the "pause and ask" workflow
   * Enhanced with YouTube-specific detection
   */
  function scanCurrentlyVisibleCaptions() {
    let foundNew = false;
    
    // YouTube-specific: Try multiple approaches
    if (currentPlatform === 'youtube') {
      // Method 1: Standard caption segments
      document.querySelectorAll('.ytp-caption-segment').forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length >= SONIC_CONFIG.MIN_CAPTION_LENGTH) {
          if (addCaptionToBuffer(text, null)) foundNew = true;
        }
      });
      
      // Method 2: Caption window spans
      document.querySelectorAll('.caption-window span, .ytp-caption-window-container span').forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length >= SONIC_CONFIG.MIN_CAPTION_LENGTH) {
          if (addCaptionToBuffer(text, null)) foundNew = true;
        }
      });
      
      // Method 3: Any visible caption-like text
      document.querySelectorAll('[class*="caption"] span').forEach(el => {
        const style = window.getComputedStyle(el);
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
        if (isVisible) {
          const text = el.textContent?.trim();
          if (text && text.length >= SONIC_CONFIG.MIN_CAPTION_LENGTH) {
            if (addCaptionToBuffer(text, null)) foundNew = true;
          }
        }
      });
    } else {
      // Generic platform handling
      const selectors = getSelectorsForPlatform();
      const visibleCaptions = document.querySelectorAll(selectors);
      
      visibleCaptions.forEach(el => {
        // Check if element is actually visible (not hidden)
        const style = window.getComputedStyle(el);
        const isVisible = style.display !== 'none' && 
                          style.visibility !== 'hidden' && 
                          style.opacity !== '0' &&
                          el.offsetParent !== null;
        
        if (isVisible) {
          const text = extractCaptionText(el);
          if (text) {
            if (addCaptionToBuffer(text, extractSpeaker(el))) foundNew = true;
          }
        }
      });
    }
    
    if (foundNew) {
      console.log('RAL Sonic Bridge: Captured currently visible caption(s), buffer size:', captionBuffer.length);
    }
    
    return foundNew;
  }
  
  /**
   * Debug function to dump current DOM state for captions
   */
  function debugCaptionElements() {
    console.log('=== RAL Sonic Bridge Debug ===');
    console.log('Platform:', currentPlatform);
    console.log('URL:', window.location.href);
    
    const captionClasses = document.querySelectorAll('[class*="caption"]');
    console.log('Elements with "caption" in class:', captionClasses.length);
    captionClasses.forEach((el, i) => {
      if (i < 10) { // First 10 only
        console.log(`  ${i}: ${el.className} -> "${el.textContent?.substring(0, 50)}"`);
      }
    });
    
    const ytpSegments = document.querySelectorAll('.ytp-caption-segment');
    console.log('.ytp-caption-segment elements:', ytpSegments.length);
    
    const captionWindows = document.querySelectorAll('.caption-window, .ytp-caption-window-container');
    console.log('Caption window containers:', captionWindows.length);
    
    console.log('Current buffer size:', captionBuffer.length);
    console.log('=== End Debug ===');
  }
  
  /**
   * Clear the caption buffer
   */
  function clearBuffer() {
    captionBuffer = [];
    recentCaptions.clear();
    console.log('RAL Sonic Bridge: Buffer cleared');
  }
  
  // ============================================================================
  // MUTATION OBSERVER
  // ============================================================================
  
  /**
   * Get the appropriate selectors for current platform
   */
  function getSelectorsForPlatform() {
    const platformSelectors = SONIC_CONFIG.SELECTORS[currentPlatform];
    if (platformSelectors) {
      return Object.values(platformSelectors).filter(Boolean).join(', ');
    }
    return SONIC_CONFIG.SELECTORS.generic.captions;
  }
  
  /**
   * Process caption mutations with debouncing
   */
  function processCaptionMutation(mutations) {
    // Debounce rapid mutations
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(() => {
      for (const mutation of mutations) {
        // Handle added nodes
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              processCaptionElement(node);
            } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
              // Direct text node addition (some caption systems do this)
              const text = extractCaptionText(node.parentElement);
              if (text) {
                addCaptionToBuffer(text, extractSpeaker(node.parentElement));
              }
            }
          }
        }
        
        // Handle character data changes (text updates)
        if (mutation.type === 'characterData') {
          const text = extractCaptionText(mutation.target.parentElement);
          if (text) {
            addCaptionToBuffer(text, extractSpeaker(mutation.target.parentElement));
          }
        }
      }
    }, SONIC_CONFIG.MUTATION_DEBOUNCE_MS);
  }
  
  /**
   * Process a potential caption element
   */
  function processCaptionElement(element) {
    const selectors = getSelectorsForPlatform();
    
    // Check if element itself matches
    if (element.matches && element.matches(selectors)) {
      const text = extractCaptionText(element);
      if (text) {
        addCaptionToBuffer(text, extractSpeaker(element));
      }
    }
    
    // Check children
    const captionElements = element.querySelectorAll?.(selectors);
    if (captionElements) {
      captionElements.forEach(el => {
        const text = extractCaptionText(el);
        if (text) {
          addCaptionToBuffer(text, extractSpeaker(el));
        }
      });
    }
  }
  
  /**
   * Initialize the MutationObserver for caption watching
   */
  function initCaptionObserver() {
    // Disconnect existing observer
    if (captionObserver) {
      captionObserver.disconnect();
    }
    
    captionObserver = new MutationObserver(processCaptionMutation);
    
    // Observe the entire document for caption changes
    captionObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: false
    });
    
    console.log(`RAL Sonic Bridge: Observer initialized for ${currentPlatform}`);
  }
  
  /**
   * Scan existing captions on page load
   */
  function scanExistingCaptions() {
    const selectors = getSelectorsForPlatform();
    const existingCaptions = document.querySelectorAll(selectors);
    
    existingCaptions.forEach(el => {
      const text = extractCaptionText(el);
      if (text) {
        addCaptionToBuffer(text, extractSpeaker(el));
      }
    });
    
    if (existingCaptions.length > 0) {
      console.log(`RAL Sonic Bridge: Found ${existingCaptions.length} existing caption elements`);
    }
  }
  
  // ============================================================================
  // MESSAGE HANDLERS
  // ============================================================================
  
  /**
   * Listen for messages from background script or popup
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'GET_SONIC_BRIDGE_CAPTIONS':
        sendResponse({
          success: true,
          captions: getBufferedCaptions()
        });
        return true;
        
      case 'CLEAR_SONIC_BRIDGE_BUFFER':
        clearBuffer();
        sendResponse({ success: true });
        return true;
        
      case 'GET_SONIC_BRIDGE_STATUS':
        sendResponse({
          success: true,
          platform: currentPlatform,
          bufferSize: captionBuffer.length,
          observerActive: !!captionObserver,
          oldestCaptionAge: captionBuffer.length > 0 
            ? Date.now() - captionBuffer[0].timestamp 
            : null
        });
        return true;
    }
  });
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  function init() {
    // Don't initialize on AI chat pages
    const aiDomains = ['chat.openai.com', 'chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai', 'poe.com'];
    if (aiDomains.some(domain => window.location.hostname.includes(domain))) {
      console.log('RAL Sonic Bridge: Skipping AI chat page');
      return;
    }
    
    // Only initialize on supported platforms or pages with video/captions
    const hasVideo = document.querySelector('video');
    const hasCaptions = document.querySelector(SONIC_CONFIG.SELECTORS.generic.captions);
    
    if (currentPlatform === 'generic' && !hasVideo && !hasCaptions) {
      console.log('RAL Sonic Bridge: No video or captions detected, staying dormant');
      return;
    }
    
    console.log(`RAL Sonic Bridge: Initializing on ${currentPlatform}`);
    console.log(`RAL Sonic Bridge: URL = ${window.location.href}`);
    
    // Debug: Show what caption elements exist
    debugCaptionElements();
    
    // Scan existing captions
    scanExistingCaptions();
    
    // Initialize observer
    initCaptionObserver();
    
    // Set up periodic pruning
    setInterval(pruneOldCaptions, SONIC_CONFIG.PRUNE_INTERVAL_MS);
    
    // IMPORTANT: Periodic scan for visible captions
    // This catches captions that the MutationObserver might miss
    // Especially useful when video is paused and captions are static
    setInterval(() => {
      const found = scanCurrentlyVisibleCaptions();
      // Debug log every 10 seconds
      if (Date.now() % 10000 < 2000) {
        console.log(`RAL Sonic Bridge: Periodic scan - buffer has ${captionBuffer.length} captions`);
      }
    }, 2000); // Scan every 2 seconds
    
    console.log('RAL Sonic Bridge: Ready (with periodic caption scanning)');
  }
  
  // Expose for debugging
  window.__RAL_SONIC_BRIDGE__ = {
    getBuffer: () => captionBuffer.slice(),
    getStatus: () => ({
      platform: currentPlatform,
      bufferSize: captionBuffer.length,
      observerActive: !!captionObserver,
      url: window.location.href
    }),
    forceCapture: () => {
      console.log('RAL Sonic Bridge: Force capture triggered');
      debugCaptionElements();
      return scanCurrentlyVisibleCaptions();
    },
    debug: () => debugCaptionElements()
  };
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Re-initialize on SPA navigation (YouTube, etc.)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      currentPlatform = detectPlatform();
      console.log(`RAL Sonic Bridge: URL changed to ${location.href}, re-initializing`);
      clearBuffer();
      init();
    }
  }).observe(document.body, { subtree: true, childList: true });
  
})();
