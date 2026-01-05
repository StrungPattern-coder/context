/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *                RAL EXTREME INTELLIGENCE - Core Module v3.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * The unified intelligence layer for all AI platform injectors.
 * Master-level upgrades:
 * 
 * 1. TOPOLOGY-BASED INPUT FINDING  - Visual heuristic walker for input detection
 * 2. GLOBAL GHOST SCRUBBER         - Centralized context hiding with badges
 * 3. REALITY ARBITER               - Intelligent context selection from global map
 * 4. HARDWARE-AWARE THROTTLING     - Adaptive compression for constrained devices
 * 5. BEHAVIORAL DISPLAY            - Shows frustration state, reading mode, intent
 * 
 * @version 3.0.0
 */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  const RAL_CORE_VERSION = '3.0.0';
  const MAX_Z_INDEX = 2147483647;
  const CONSTRAINED_TOKEN_LIMIT = 500;
  
  // Platform-specific configurations
  const PLATFORM_CONFIG = {
    chatgpt: {
      name: 'ChatGPT',
      color: '#10a37f',
      supportsXml: true,
      preferredFormat: 'xml',
      inputSelectors: [
        '#prompt-textarea',
        'textarea[data-id="root"]',
        'textarea[placeholder*="Message"]',
        'div[contenteditable="true"][id="prompt-textarea"]',
      ],
      sendSelectors: [
        'button[data-testid="send-button"]',
        'button[data-testid="fruitjuice-send-button"]',
        'button[aria-label*="Send"]',
      ],
    },
    claude: {
      name: 'Claude',
      color: '#d97706',
      supportsXml: true,
      preferredFormat: 'xml',
      inputSelectors: [
        '[contenteditable="true"]',
        'div[data-placeholder]',
        'textarea',
      ],
      sendSelectors: [
        'button[aria-label="Send Message"]',
        'button[type="submit"]',
        '[data-testid="send-button"]',
      ],
    },
    gemini: {
      name: 'Gemini',
      color: '#4285f4',
      supportsXml: true,
      preferredFormat: 'xml',
      inputSelectors: [
        'textarea',
        '[contenteditable="true"]',
        'rich-textarea textarea',
      ],
      sendSelectors: [
        'button[aria-label*="Send"]',
        'button[aria-label*="Submit"]',
        '.send-button',
      ],
    },
    perplexity: {
      name: 'Perplexity',
      color: '#20b2aa',
      supportsXml: true,
      preferredFormat: 'xml',
      inputSelectors: [
        'textarea[placeholder*="Ask"]',
        'textarea',
      ],
      sendSelectors: [
        'button[type="submit"]',
        'button[aria-label*="Submit"]',
      ],
    },
    poe: {
      name: 'Poe',
      color: '#7c3aed',
      supportsXml: false,
      preferredFormat: 'flat',
      inputSelectors: [
        'textarea[class*="TextArea"]',
        'textarea[placeholder*="message"]',
        'textarea',
      ],
      sendSelectors: [
        'button[class*="Send"]',
        'button[type="submit"]',
      ],
    },
    huggingchat: {
      name: 'HuggingChat',
      color: '#ff6f00',
      supportsXml: false,
      preferredFormat: 'system',
      inputSelectors: [
        'textarea',
        '[contenteditable="true"]',
      ],
      sendSelectors: [
        'button[type="submit"]',
      ],
    },
    generic: {
      name: 'AI Chat',
      color: '#6366f1',
      supportsXml: false,
      preferredFormat: 'flat',
      inputSelectors: [
        'textarea',
        'input[type="text"]',
      ],
      sendSelectors: [
        'button[type="submit"]',
        'button',
      ],
    },
  };

  // ============================================================================
  // STATE
  // ============================================================================
  
  const state = {
    platform: null,
    config: null,
    enabled: true,
    extensionValid: true,
    lastContext: null,
    lastInjection: null,
    behavioralState: null,
    isProcessing: false,
    injectionCount: 0,
    systemConstraints: null,
    ghostScrubberActive: false,
  };

  // ============================================================================
  // COMMUNICATION LAYER
  // ============================================================================
  
  /**
   * Robust message sender with error recovery
   */
  async function sendMessage(message) {
    return new Promise((resolve) => {
      try {
        if (!chrome.runtime?.id) {
          console.warn('RAL Core: Extension context invalidated');
          state.extensionValid = false;
          resolve({ _extensionError: true });
          return;
        }
        
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message;
            console.warn('RAL Core: Message error:', errorMsg);
            
            if (errorMsg.includes('invalidated') || errorMsg.includes('context')) {
              state.extensionValid = false;
              resolve({ _extensionError: true });
            } else {
              resolve(null);
            }
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        console.warn('RAL Core: Send failed:', e);
        state.extensionValid = false;
        resolve({ _extensionError: true });
      }
    });
  }

  /**
   * Get settings from service worker
   */
  async function getSettings() {
    const response = await sendMessage({ type: 'GET_SETTINGS' });
    return response || { enabled: true };
  }

  /**
   * Get full context with synthesis from service worker
   */
  async function getContext(prompt = '') {
    const response = await sendMessage({ 
      type: 'GET_CONTEXT', 
      platform: state.platform,
      prompt: prompt 
    });
    
    if (response?._extensionError) {
      return { _extensionError: true, enabled: false };
    }
    
    // Cache the context
    if (response) {
      state.lastContext = response;
      state.behavioralState = extractBehavioralState(response);
      
      // v3.0: Extract system constraints for hardware-aware throttling
      if (response.context?.system_telemetry) {
        state.systemConstraints = response.context.system_telemetry;
      }
    }
    
    return response || { enabled: false };
  }

  /**
   * Get global reality map
   */
  async function getGlobalReality() {
    return await sendMessage({ type: 'GET_GLOBAL_REALITY' });
  }

  /**
   * Get telemetry data
   */
  async function getTelemetry() {
    return await sendMessage({ type: 'GET_TELEMETRY' });
  }

  // ============================================================================
  // CONTEXT PROCESSOR
  // ============================================================================
  
  /**
   * Extract behavioral state from context response
   */
  function extractBehavioralState(contextData) {
    if (!contextData) return null;
    
    const synthesis = contextData.synthesis || {};
    const context = contextData.context || {};
    
    return {
      confidence: synthesis.confidence || 'UNKNOWN',
      userIntent: synthesis.userIntent || 'UNKNOWN',
      primaryLanguage: synthesis.primaryLanguage || null,
      frustrationLevel: detectFrustrationLevel(context),
      readingMode: context.selection?.telemetry?.readingMode || null,
      cognitiveLoad: context.selection?.telemetry?.cognitiveLoad || null,
    };
  }

  /**
   * Detect frustration level from context
   */
  function detectFrustrationLevel(context) {
    const selection = context.selection;
    const telemetry = selection?.telemetry;
    
    if (telemetry?.cognitiveLoad === 'FRUSTRATED') return 'HIGH';
    if (telemetry?.frustration?.recentSelectionRepeats > 2) return 'ELEVATED';
    
    // Check if we have system instructions mentioning frustration
    const injection = context.injection?.formatted || '';
    if (injection.includes('EMERGENCY') || injection.includes('struggling')) {
      return 'HIGH';
    }
    
    return 'NORMAL';
  }

  /**
   * Process context for intelligent injection
   * Returns the optimal injection format based on platform and context
   */
  function processContextForInjection(contextData) {
    if (!contextData?.enabled) return null;
    
    const config = state.config;
    const behavioralState = state.behavioralState;
    
    // Use the pre-formatted injection from service worker if available
    if (contextData.injection?.formatted) {
      return {
        text: contextData.injection.formatted,
        type: 'multimodal',
        behavioral: behavioralState,
      };
    }
    
    // Fallback: build simple injection
    if (contextData.contextString) {
      const format = config.supportsXml 
        ? `<reality_context>\n${contextData.contextString}\n</reality_context>\n\n`
        : `[Context: ${contextData.contextString}]\n\n`;
      
      return {
        text: format,
        type: 'simple',
        behavioral: behavioralState,
      };
    }
    
    return null;
  }

  /**
   * Check if text already has context injected
   */
  function hasExistingContext(text) {
    const markers = [
      '<reality_context',
      '<context>',
      '[Context:',
      '[Current context:',
      '[User context:',
      '[System context]',
      '### Context',
      '### Reality Context',
      '<!-- RAL -->',
    ];
    return markers.some(m => text.includes(m));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //          v3.0 FEATURE 1: TOPOLOGY-BASED INPUT FINDING
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Visual Heuristic Walker - Finds chat input by visual/semantic analysis
   * Supplements selector-based finding with intelligent DOM traversal
   */
  function visualHeuristicWalker() {
    const candidates = [];
    
    // Strategy 1: Find all contenteditable elements
    const editables = document.querySelectorAll('[contenteditable="true"]');
    for (const el of editables) {
      if (isViableInputCandidate(el)) {
        candidates.push({ element: el, score: scoreInputCandidate(el, 'contenteditable') });
      }
    }
    
    // Strategy 2: Find all role="textbox" elements
    const textboxes = document.querySelectorAll('[role="textbox"]');
    for (const el of textboxes) {
      if (isViableInputCandidate(el)) {
        candidates.push({ element: el, score: scoreInputCandidate(el, 'textbox') });
      }
    }
    
    // Strategy 3: Find visible textareas in main content area
    const textareas = document.querySelectorAll('textarea');
    for (const el of textareas) {
      if (isViableInputCandidate(el)) {
        candidates.push({ element: el, score: scoreInputCandidate(el, 'textarea') });
      }
    }
    
    // Strategy 4: Find inputs with chat-related placeholders
    const inputs = document.querySelectorAll('input[type="text"]');
    for (const el of inputs) {
      const placeholder = (el.placeholder || '').toLowerCase();
      if (placeholder.includes('message') || placeholder.includes('ask') || placeholder.includes('chat')) {
        if (isViableInputCandidate(el)) {
          candidates.push({ element: el, score: scoreInputCandidate(el, 'input') });
        }
      }
    }
    
    // Sort by score (highest first) and return best candidate
    candidates.sort((a, b) => b.score - a.score);
    
    if (candidates.length > 0) {
      console.log('RAL v3.0: Visual Walker found', candidates.length, 'candidates');
      return candidates[0].element;
    }
    
    return null;
  }

  /**
   * Check if element is a viable input candidate
   */
  function isViableInputCandidate(el) {
    if (!el) return false;
    if (!isVisible(el)) return false;
    
    const rect = el.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 20) return false;
    
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    if (parseFloat(style.opacity) < 0.1) return false;
    
    const inModal = el.closest('[role="dialog"]') || el.closest('.modal');
    if (inModal && !inModal.querySelector('[data-testid*="chat"], [class*="chat"]')) {
      return false;
    }
    
    return true;
  }

  /**
   * Score an input candidate based on heuristics
   */
  function scoreInputCandidate(el, type) {
    let score = 0;
    
    const typeScores = { contenteditable: 10, textbox: 10, textarea: 8, input: 5 };
    score += typeScores[type] || 0;
    
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const bottomDistance = viewportHeight - rect.bottom;
    if (bottomDistance < 200) score += 20;
    if (bottomDistance < 100) score += 10;
    
    if (rect.width > 400) score += 10;
    if (rect.height > 40) score += 5;
    
    const placeholder = el.placeholder || el.getAttribute('aria-placeholder') || '';
    const ariaLabel = el.getAttribute('aria-label') || '';
    const combined = (placeholder + ariaLabel).toLowerCase();
    
    if (combined.includes('message')) score += 15;
    if (combined.includes('send')) score += 10;
    if (combined.includes('ask')) score += 10;
    if (combined.includes('chat')) score += 10;
    if (combined.includes('prompt')) score += 10;
    
    const id = (el.id || '').toLowerCase();
    const className = (el.className || '').toLowerCase();
    const combined2 = id + className;
    
    if (combined2.includes('prompt')) score += 15;
    if (combined2.includes('input')) score += 5;
    if (combined2.includes('message')) score += 10;
    if (combined2.includes('chat')) score += 10;
    if (combined2.includes('compose')) score += 10;
    
    if (el.closest('form')) score += 5;
    if (el.closest('main') || el.closest('[role="main"]')) score += 5;
    if (el.tabIndex >= 0) score += 3;
    
    return score;
  }

  /**
   * Find the input element for the current platform
   * Uses both selectors AND visual heuristic walker
   */
  function findInput() {
    const selectors = state.config?.inputSelectors || ['textarea'];
    
    // Strategy 1: Try platform-specific selectors first
    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) {
          return el;
        }
      } catch (e) {}
    }
    
    // Strategy 2: Visual Heuristic Walker (topology-based)
    const walkerResult = visualHeuristicWalker();
    if (walkerResult) {
      console.log('RAL v3.0: Found input via Visual Walker');
      return walkerResult;
    }
    
    // Strategy 3: Fallback - any visible textarea
    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
      if (isVisible(ta)) return ta;
    }
    
    return null;
  }

  /**
   * Find the send button using topology analysis
   */
  function findSendButton() {
    const selectors = state.config?.sendSelectors || ['button[type="submit"]'];
    
    // Strategy 1: Platform-specific selectors
    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          const btn = el.tagName === 'BUTTON' ? el : el.closest('button');
          if (btn && isVisible(btn)) return btn;
        }
      } catch (e) {}
    }
    
    // Strategy 2: Find buttons near the input
    const input = findInput();
    if (input) {
      const form = input.closest('form');
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"], button:not([type])');
        if (submitBtn && isVisible(submitBtn)) return submitBtn;
      }
      
      const container = input.parentElement?.parentElement;
      if (container) {
        const buttons = container.querySelectorAll('button');
        for (const btn of buttons) {
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          const text = (btn.textContent || '').toLowerCase();
          if (ariaLabel.includes('send') || text.includes('send') || btn.querySelector('svg')) {
            if (isVisible(btn)) return btn;
          }
        }
      }
    }
    
    // Strategy 3: Find any button with send-like attributes
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      const className = (btn.className || '').toLowerCase();
      
      if (ariaLabel.includes('send') || className.includes('send')) {
        if (isVisible(btn)) return btn;
      }
    }
    
    return null;
  }

  /**
   * Check if element is visible
   */
  function isVisible(el) {
    if (!el) return false;
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Get value from input (handles both textarea and contenteditable)
   */
  function getInputValue(element) {
    if (!element) return '';
    
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return element.value || '';
    }
    
    // Contenteditable
    return element.innerText || element.textContent || '';
  }

  /**
   * Set value on input (with React compatibility)
   */
  function setInputValue(element, newValue) {
    if (!element) return;
    
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      // Use native setter to bypass React
      const proto = element.tagName === 'TEXTAREA' 
        ? window.HTMLTextAreaElement.prototype 
        : window.HTMLInputElement.prototype;
      
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      
      if (nativeSetter) {
        nativeSetter.call(element, newValue);
      } else {
        element.value = newValue;
      }
    } else {
      // Contenteditable
      element.innerText = newValue;
    }
    
    // Trigger events for framework detection
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    
    if (element.isContentEditable) {
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: newValue
      }));
    }
  }

  // ============================================================================
  // INJECTION ENGINE
  // ============================================================================
  
  /**
   * Main injection function (v3.0 Enhanced)
   * Now includes Reality Arbiter, Hardware Throttling, and Ghost Scrubber
   * Returns: true (injected), false (failed), 'skip' (extension error)
   */
  async function injectContext(element) {
    if (!element || state.isProcessing) return false;
    
    const currentValue = getInputValue(element);
    
    // Validation
    if (currentValue.trim().length < 3) {
      console.log('RAL Core: Message too short');
      return false;
    }
    
    if (hasExistingContext(currentValue)) {
      console.log('RAL Core: Already has context');
      return false;
    }
    
    state.isProcessing = true;
    
    try {
      // v3.0: Try Reality Arbiter first for multi-thread scenarios
      let contextData = await getArbitratedContext(currentValue);
      
      // Handle extension errors
      if (contextData?._extensionError) {
        console.log('RAL Core: Extension error, allowing through');
        return 'skip';
      }
      
      if (!contextData?.enabled) {
        console.log('RAL Core: Context disabled');
        return false;
      }
      
      // v3.0: Apply hardware-aware throttling if constrained
      if (isSystemConstrained()) {
        contextData = compressContextForConstraints(contextData);
        updateIndicator('constrained', contextData.behavioral);
      }
      
      // Process for injection
      const injection = processContextForInjection(contextData);
      
      if (!injection) {
        console.log('RAL Core: No valid injection');
        return false;
      }
      
      // Build augmented message
      const newValue = injection.text + currentValue;
      
      // Inject
      setInputValue(element, newValue);
      
      // Update state
      state.lastInjection = injection;
      state.injectionCount++;
      
      // v3.0: Ensure Ghost Scrubber is active after injection
      setupGlobalGhostScrubber();
      
      // Update UI
      updateIndicator('active', injection.behavioral);
      flashIndicator();
      
      console.log('RAL Core v3.0: Injected!', {
        platform: state.platform,
        type: injection.type,
        behavioral: injection.behavioral,
        compressed: contextData._compressed || false,
      });
      
      return true;
      
    } catch (e) {
      console.error('RAL Core: Injection error:', e);
      return false;
    } finally {
      state.isProcessing = false;
    }
  }

  // ============================================================================
  // UI COMPONENTS
  // ============================================================================
  
  /**
   * Create the RAL indicator with extended information
   */
  function createIndicator() {
    if (document.getElementById('ral-indicator')) return;
    
    const config = state.config;
    const indicator = document.createElement('div');
    indicator.id = 'ral-indicator';
    indicator.className = 'ral-indicator';
    indicator.innerHTML = `
      <div class="ral-indicator-main">
        <div class="ral-indicator-dot" style="--dot-color: ${config.color}"></div>
        <span class="ral-indicator-text">RAL</span>
        <span class="ral-indicator-version">v${RAL_CORE_VERSION}</span>
      </div>
      <div class="ral-indicator-status"></div>
      <div class="ral-indicator-expand" title="Show details">▼</div>
      <div class="ral-indicator-details">
        <div class="ral-detail-row">
          <span class="ral-detail-label">Platform</span>
          <span class="ral-detail-value">${config.name}</span>
        </div>
        <div class="ral-detail-row ral-detail-intent">
          <span class="ral-detail-label">Intent</span>
          <span class="ral-detail-value">—</span>
        </div>
        <div class="ral-detail-row ral-detail-mode">
          <span class="ral-detail-label">Mode</span>
          <span class="ral-detail-value">—</span>
        </div>
        <div class="ral-detail-row ral-detail-language">
          <span class="ral-detail-label">Language</span>
          <span class="ral-detail-value">—</span>
        </div>
        <div class="ral-detail-row ral-detail-injections">
          <span class="ral-detail-label">Injections</span>
          <span class="ral-detail-value">0</span>
        </div>
      </div>
    `;
    
    document.body.appendChild(indicator);
    
    // Toggle details on click
    const expand = indicator.querySelector('.ral-indicator-expand');
    expand.addEventListener('click', (e) => {
      e.stopPropagation();
      indicator.classList.toggle('ral-expanded');
      expand.textContent = indicator.classList.contains('ral-expanded') ? '▲' : '▼';
    });
    
    console.log('RAL Core: Indicator created');
  }

  /**
   * Update indicator state and details
   */
  function updateIndicator(status, behavioral) {
    const indicator = document.getElementById('ral-indicator');
    if (!indicator) return;
    
    // Update status badge
    const statusEl = indicator.querySelector('.ral-indicator-status');
    if (statusEl) {
      switch (status) {
        case 'active':
          statusEl.textContent = '✓';
          statusEl.className = 'ral-indicator-status ral-status-active';
          indicator.classList.remove('ral-constrained-mode');
          break;
        case 'frustrated':
          statusEl.textContent = '⚠️';
          statusEl.className = 'ral-indicator-status ral-status-frustrated';
          indicator.classList.remove('ral-constrained-mode');
          break;
        case 'constrained':
          statusEl.textContent = '⚡';
          statusEl.className = 'ral-indicator-status ral-status-active';
          indicator.classList.add('ral-constrained-mode');
          break;
        case 'disabled':
          statusEl.textContent = '✗';
          statusEl.className = 'ral-indicator-status ral-status-disabled';
          indicator.classList.remove('ral-constrained-mode');
          break;
        default:
          statusEl.textContent = '';
          statusEl.className = 'ral-indicator-status';
      }
    }
    
    // Update details
    if (behavioral) {
      updateDetailValue(indicator, '.ral-detail-intent', behavioral.userIntent || '—');
      updateDetailValue(indicator, '.ral-detail-mode', behavioral.readingMode || '—');
      updateDetailValue(indicator, '.ral-detail-language', behavioral.primaryLanguage || '—');
      updateDetailValue(indicator, '.ral-detail-injections', state.injectionCount.toString());
      
      // Add frustration class if needed
      if (behavioral.frustrationLevel === 'HIGH') {
        indicator.classList.add('ral-frustrated');
      } else {
        indicator.classList.remove('ral-frustrated');
      }
    }
  }

  function updateDetailValue(indicator, selector, value) {
    const row = indicator.querySelector(selector);
    if (row) {
      const valueEl = row.querySelector('.ral-detail-value');
      if (valueEl) valueEl.textContent = value;
    }
  }

  /**
   * Flash the indicator to show injection happened
   */
  function flashIndicator() {
    const indicator = document.getElementById('ral-indicator');
    if (!indicator) return;
    
    indicator.classList.add('ral-flash');
    setTimeout(() => indicator.classList.remove('ral-flash'), 600);
  }

  /**
   * Show frustration alert (for high frustration states)
   */
  function showFrustrationAlert() {
    const existing = document.getElementById('ral-frustration-alert');
    if (existing) existing.remove();
    
    const alert = document.createElement('div');
    alert.id = 'ral-frustration-alert';
    alert.className = 'ral-frustration-alert';
    alert.innerHTML = `
      <div class="ral-alert-content">
        <span class="ral-alert-icon">⚡</span>
        <span class="ral-alert-text">RAL detected frustration - providing direct solutions</span>
      </div>
    `;
    
    document.body.appendChild(alert);
    
    setTimeout(() => {
      alert.classList.add('ral-alert-fade');
      setTimeout(() => alert.remove(), 500);
    }, 3000);
  }

  // ============================================================================
  // STYLES
  // ============================================================================
  
  function injectStyles() {
    if (document.getElementById('ral-core-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'ral-core-styles';
    style.textContent = `
      /* RAL Indicator */
      .ral-indicator {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 100000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        transition: all 0.3s ease;
      }
      
      .ral-indicator-main {
        display: flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(135deg, #1e293b, #334155);
        padding: 8px 12px;
        border-radius: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        cursor: pointer;
      }
      
      .ral-indicator-dot {
        width: 10px;
        height: 10px;
        background: var(--dot-color, #4ade80);
        border-radius: 50%;
        animation: ral-pulse 2s infinite;
        box-shadow: 0 0 8px var(--dot-color, #4ade80);
      }
      
      .ral-indicator-text {
        color: white;
        font-weight: 700;
        font-size: 13px;
      }
      
      .ral-indicator-version {
        color: #94a3b8;
        font-size: 10px;
        font-weight: 400;
      }
      
      .ral-indicator-status {
        position: absolute;
        top: -4px;
        right: -4px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        background: #1e293b;
      }
      
      .ral-status-active {
        background: #22c55e;
        color: white;
      }
      
      .ral-status-frustrated {
        background: #ef4444;
        animation: ral-pulse-fast 0.5s infinite;
      }
      
      .ral-status-disabled {
        background: #6b7280;
        color: white;
      }
      
      .ral-indicator-expand {
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        background: #475569;
        color: white;
        font-size: 8px;
        padding: 2px 6px;
        border-radius: 4px;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s;
      }
      
      .ral-indicator:hover .ral-indicator-expand {
        opacity: 1;
      }
      
      .ral-indicator-details {
        display: none;
        background: #1e293b;
        margin-top: 8px;
        padding: 12px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
      
      .ral-indicator.ral-expanded .ral-indicator-details {
        display: block;
      }
      
      .ral-detail-row {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        border-bottom: 1px solid #334155;
      }
      
      .ral-detail-row:last-child {
        border-bottom: none;
      }
      
      .ral-detail-label {
        color: #94a3b8;
      }
      
      .ral-detail-value {
        color: white;
        font-weight: 500;
      }
      
      /* Animations */
      @keyframes ral-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(0.95); }
      }
      
      @keyframes ral-pulse-fast {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
      
      .ral-flash .ral-indicator-main {
        animation: ral-flash-anim 0.6s ease-out;
      }
      
      @keyframes ral-flash-anim {
        0% { transform: scale(1); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        30% { transform: scale(1.15); box-shadow: 0 0 20px rgba(74, 222, 128, 0.6); }
        100% { transform: scale(1); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
      }
      
      /* Frustrated state */
      .ral-indicator.ral-frustrated .ral-indicator-main {
        background: linear-gradient(135deg, #7f1d1d, #991b1b);
      }
      
      .ral-indicator.ral-frustrated .ral-indicator-dot {
        background: #fbbf24;
        animation: ral-pulse-fast 0.5s infinite;
      }
      
      /* Frustration Alert */
      .ral-frustration-alert {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 100001;
        background: linear-gradient(135deg, #dc2626, #b91c1c);
        padding: 12px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(185, 28, 28, 0.4);
        animation: ral-slide-in 0.3s ease-out;
      }
      
      .ral-alert-content {
        display: flex;
        align-items: center;
        gap: 10px;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        font-weight: 500;
      }
      
      .ral-alert-icon {
        font-size: 18px;
      }
      
      .ral-alert-fade {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
        transition: all 0.5s ease-out;
      }
      
      @keyframes ral-slide-in {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
      
      /* v3.0 Ghost Scrubber Styles */
      .ral-ghost-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: 4px;
        vertical-align: middle;
        box-shadow: 0 1px 3px rgba(99, 102, 241, 0.3);
      }
      
      .ral-ghost-badge.ral-ghost-scrubbed {
        background: linear-gradient(135deg, #22c55e, #16a34a);
      }
      
      .ral-ghost-marker {
        opacity: 0.5;
        font-style: italic;
        color: #94a3b8;
      }
      
      /* Reality Arbiter Status */
      .ral-arbiter-status {
        position: absolute;
        bottom: -20px;
        right: 0;
        font-size: 9px;
        color: #64748b;
        white-space: nowrap;
      }
      
      .ral-constrained-mode .ral-indicator-main {
        background: linear-gradient(135deg, #f97316, #ea580c);
      }
    `;
    
    document.head.appendChild(style);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //          v3.0 FEATURE 2: GLOBAL GHOST SCRUBBER
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Setup the Global Ghost Scrubber - hides RAL context from AI responses
   * Uses MutationObserver for real-time scrubbing
   */
  function setupGlobalGhostScrubber() {
    if (state.ghostScrubberActive) return;
    
    const contextPatterns = [
      /\[RAL Context:[\s\S]*?\]/g,
      /\[Context:[\s\S]*?\]/g,
      /<!-- RAL -->[\s\S]*?<!-- \/RAL -->/g,
      /### Reality Context[\s\S]*?###/g,
      /\[System context\][\s\S]*?\[\/System context\]/g,
      /<context>[\s\S]*?<\/context>/gi,
      /\[behavioral_anchor\][\s\S]*?\[\/behavioral_anchor\]/g,
    ];
    
    const scrubTextContent = (text) => {
      let scrubbed = text;
      for (const pattern of contextPatterns) {
        scrubbed = scrubbed.replace(pattern, '');
      }
      return scrubbed;
    };
    
    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        const original = node.textContent;
        const scrubbed = scrubTextContent(original);
        if (scrubbed !== original) {
          node.textContent = scrubbed;
          console.log('RAL v3.0: Ghost Scrubber cleaned context');
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Skip input elements and our own elements
        if (node.tagName === 'TEXTAREA' || node.tagName === 'INPUT') return;
        if (node.id?.startsWith('ral-')) return;
        if (node.className?.includes?.('ral-')) return;
        
        for (const child of node.childNodes) {
          processNode(child);
        }
      }
    };
    
    // Look for response containers to observe
    const responseSelectors = [
      '[data-message-author-role="assistant"]',
      '.markdown-body',
      '.prose',
      '[class*="response"]',
      '[class*="message-content"]',
      '[class*="assistant"]',
      '.chat-message-text',
    ];
    
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this looks like a response
            const isResponse = responseSelectors.some(sel => {
              try { return node.matches?.(sel) || node.querySelector?.(sel); }
              catch { return false; }
            });
            
            if (isResponse) {
              // Delay to let content fully render
              setTimeout(() => processNode(node), 100);
            }
          }
        }
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    
    state.ghostScrubberActive = true;
    console.log('RAL v3.0: Global Ghost Scrubber activated');
  }

  /**
   * Create a badge showing context was applied (for debugging/UI)
   */
  function createGhostBadge(type = 'injected') {
    const badge = document.createElement('span');
    badge.className = `ral-ghost-badge ${type === 'scrubbed' ? 'ral-ghost-scrubbed' : ''}`;
    badge.innerHTML = type === 'scrubbed' ? '👻 Scrubbed' : '⚡ RAL';
    return badge;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //          v3.0 FEATURE 3: REALITY ARBITER
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Reality Arbiter - Selects optimal context from globalRealityMap
   * Resolves conflicts when multiple threads/tabs have different contexts
   */
  function arbitrateReality(realityMap) {
    if (!realityMap || Object.keys(realityMap).length === 0) {
      return null;
    }
    
    const candidates = [];
    const now = Date.now();
    
    for (const [threadId, reality] of Object.entries(realityMap)) {
      if (!reality || !reality.context) continue;
      
      const score = calculateInteractionScore(reality, now);
      candidates.push({
        threadId,
        reality,
        score,
      });
    }
    
    if (candidates.length === 0) return null;
    
    // Sort by score (highest first)
    candidates.sort((a, b) => b.score - a.score);
    
    const winner = candidates[0];
    console.log(`RAL v3.0: Reality Arbiter selected thread ${winner.threadId} (score: ${winner.score.toFixed(2)})`);
    
    return winner.reality;
  }

  /**
   * Calculate interaction score for a reality entry
   * Higher score = more relevant context
   */
  function calculateInteractionScore(reality, now) {
    let score = 0;
    
    // Recency factor (max 40 points, decays over 5 minutes)
    if (reality.timestamp) {
      const age = now - reality.timestamp;
      const maxAge = 5 * 60 * 1000; // 5 minutes
      const recencyScore = Math.max(0, 40 * (1 - age / maxAge));
      score += recencyScore;
    }
    
    // Context richness factor (max 30 points)
    if (reality.context) {
      const hasIntent = reality.context.userIntent ? 10 : 0;
      const hasLanguage = reality.context.primaryLanguage ? 5 : 0;
      const hasFrustration = reality.context.frustrationLevel ? 5 : 0;
      const hasXml = reality.context.xml ? 10 : 0;
      score += hasIntent + hasLanguage + hasFrustration + hasXml;
    }
    
    // Interaction count factor (max 20 points)
    if (reality.interactionCount) {
      score += Math.min(20, reality.interactionCount * 2);
    }
    
    // Active thread bonus (10 points if this is current thread)
    if (reality.isActive) {
      score += 10;
    }
    
    return score;
  }

  /**
   * Get arbitrated context from global reality map
   */
  async function getArbitratedContext(prompt) {
    const realityData = await getGlobalReality();
    
    if (realityData?.globalRealityMap) {
      const arbitrated = arbitrateReality(realityData.globalRealityMap);
      if (arbitrated) {
        return arbitrated;
      }
    }
    
    // Fall back to regular context
    return getContext(prompt);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //          v3.0 FEATURE 4: HARDWARE-AWARE THROTTLING
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Check if system is constrained (low memory, CPU, battery, etc.)
   */
  function isSystemConstrained() {
    const constraints = state.systemConstraints;
    if (!constraints) return false;
    
    // Check memory (if available)
    if (constraints.deviceMemory && constraints.deviceMemory < 4) {
      return true;
    }
    
    // Check CPU cores (if available)
    if (constraints.hardwareConcurrency && constraints.hardwareConcurrency < 4) {
      return true;
    }
    
    // Check connection type
    if (constraints.connection) {
      const slowConnections = ['slow-2g', '2g', '3g'];
      if (slowConnections.includes(constraints.connection.effectiveType)) {
        return true;
      }
    }
    
    // Check save-data mode
    if (constraints.saveData) {
      return true;
    }
    
    return false;
  }

  /**
   * Compress context for constrained systems
   * Targets ~500 tokens for low-end devices
   */
  function compressContextForConstraints(context) {
    if (!context) return context;
    
    const compressed = { ...context };
    
    // Compress XML if present (main token consumer)
    if (compressed.xml && compressed.xml.length > 500) {
      compressed.xml = compressXmlContext(compressed.xml);
      compressed._compressed = true;
    }
    
    // Remove verbose fields
    delete compressed.rawBehavioral;
    delete compressed.debug;
    
    // Simplify behavioral data
    if (compressed.behavioral) {
      compressed.behavioral = {
        userIntent: compressed.behavioral.userIntent,
        frustrationLevel: compressed.behavioral.frustrationLevel,
        primaryLanguage: compressed.behavioral.primaryLanguage,
      };
    }
    
    console.log('RAL v3.0: Context compressed for constrained system');
    return compressed;
  }

  /**
   * Compress XML context to fit token budget
   */
  function compressXmlContext(xml) {
    if (!xml) return xml;
    
    // Remove comments
    let compressed = xml.replace(/<!--[\s\S]*?-->/g, '');
    
    // Collapse whitespace
    compressed = compressed.replace(/\s+/g, ' ').trim();
    
    // If still too long, truncate intelligently
    if (compressed.length > CONSTRAINED_TOKEN_LIMIT * 4) {
      // Find key elements to preserve
      const preservePatterns = [
        /<user_intent>[\s\S]*?<\/user_intent>/i,
        /<frustration_level>[\s\S]*?<\/frustration_level>/i,
        /<primary_language>[\s\S]*?<\/primary_language>/i,
      ];
      
      let essential = '';
      for (const pattern of preservePatterns) {
        const match = compressed.match(pattern);
        if (match) essential += match[0] + ' ';
      }
      
      if (essential.length > 0) {
        compressed = `<context_summary>${essential.trim()}</context_summary>`;
      } else {
        // Last resort: hard truncate
        compressed = compressed.substring(0, CONSTRAINED_TOKEN_LIMIT * 4) + '...';
      }
    }
    
    return compressed;
  }

  /**
   * Detect system constraints on initialization
   */
  function detectSystemConstraints() {
    state.systemConstraints = {
      deviceMemory: navigator.deviceMemory || null,
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      connection: navigator.connection || null,
      saveData: navigator.connection?.saveData || false,
    };
    
    if (isSystemConstrained()) {
      console.log('RAL v3.0: System constraints detected, enabling throttling');
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================
  
  window.RALCore = {
    version: RAL_CORE_VERSION,
    
    /**
     * Initialize RAL Core for a platform (v3.0 Enhanced)
     */
    async init(platform) {
      state.platform = platform;
      state.config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.generic;
      
      console.log(`RAL Core v${RAL_CORE_VERSION}: Initializing for ${state.config.name}`);
      
      // v3.0: Detect system constraints early
      detectSystemConstraints();
      
      // Check if enabled
      const settings = await getSettings();
      state.enabled = settings?.enabled !== false;
      
      if (!state.enabled) {
        console.log('RAL Core: Extension disabled');
        return false;
      }
      
      // Inject UI
      injectStyles();
      createIndicator();
      
      // v3.0: Setup Ghost Scrubber proactively
      setupGlobalGhostScrubber();
      
      console.log(`RAL Core v${RAL_CORE_VERSION}: Ready for ${state.config.name}`, {
        systemConstrained: isSystemConstrained(),
        ghostScrubberActive: state.ghostScrubberActive,
      });
      return true;
    },
    
    /**
     * Get the current state
     */
    getState() {
      return { ...state };
    },
    
    /**
     * Find input element
     */
    findInput,
    
    /**
     * Find send button
     */
    findSendButton,
    
    /**
     * Get input value
     */
    getInputValue,
    
    /**
     * Set input value
     */
    setInputValue,
    
    /**
     * Inject context into element
     */
    injectContext,
    
    /**
     * Check if has existing context
     */
    hasExistingContext,
    
    /**
     * Update indicator
     */
    updateIndicator,
    
    /**
     * Flash indicator
     */
    flashIndicator,
    
    /**
     * Show frustration alert
     */
    showFrustrationAlert,
    
    /**
     * Get context (for advanced use)
     */
    getContext,
    
    /**
     * Get global reality (for advanced use)
     */
    getGlobalReality,
    
    /**
     * Get current behavioral state
     */
    getBehavioralState() {
      return state.behavioralState;
    },
    
    /**
     * Check if extension is valid
     */
    isExtensionValid() {
      return state.extensionValid;
    },
    
    // ═══════════════════════════════════════════════════════════════
    //              v3.0 EXTREME INTELLIGENCE API
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * v3.0: Visual Heuristic Walker - topology-based input finding
     */
    visualHeuristicWalker,
    
    /**
     * v3.0: Setup Global Ghost Scrubber
     */
    setupGlobalGhostScrubber,
    
    /**
     * v3.0: Reality Arbiter - select optimal context from multi-thread scenarios
     */
    arbitrateReality,
    
    /**
     * v3.0: Get arbitrated context
     */
    getArbitratedContext,
    
    /**
     * v3.0: Check if system is constrained
     */
    isSystemConstrained,
    
    /**
     * v3.0: Compress context for constrained systems
     */
    compressContextForConstraints,
    
    /**
     * v3.0: Get system constraints status
     */
    getSystemConstraints() {
      return { ...state.systemConstraints };
    },
    
    /**
     * v3.0: Check if Ghost Scrubber is active
     */
    isGhostScrubberActive() {
      return state.ghostScrubberActive;
    },
  };

  console.log(`RAL Core v${RAL_CORE_VERSION} Extreme Intelligence loaded`);
  
})();
