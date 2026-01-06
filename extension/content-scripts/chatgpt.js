/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *         RAL MASTER INJECTOR - ChatGPT v4.6 (Single Source of Truth)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * The definitive, self-contained ChatGPT integration. Zero external dependencies.
 * This is the ONLY file needed for ChatGPT context injection.
 * 
 * EXTREME INTELLIGENCE FEATURES:
 *   1. Flicker-Free Ghost Scrubbing  - Hidden span + badge, no XML flash
 *   2. Brute-Force React Sync        - Synthetic Tickle for 100% reliability
 *   3. Smart Adaptive Badges         - Edit/Frustrated/Normal variants
 *   4. Cinematic Animations          - Materialize effect, blur-to-clear
 *   5. Orb Polish                    - Max z-index, pointer-events safe
 *   6. Smart Retries                 - Loading state prevents double-clicks
 *   7. Clean Input Detection         - Edit vs New message discrimination
 * 
 * @version 4.6.0
 * @license MIT
 */

(function() {
  'use strict';

  // ════════════════════════════════════════════════════════════════════════════
  //                              CONFIGURATION
  // ════════════════════════════════════════════════════════════════════════════

  const RAL_VERSION = '4.6.0';
  const PLATFORM = 'chatgpt';
  const MAX_Z_INDEX = 2147483647;

  // ════════════════════════════════════════════════════════════════════════════
  //                              STATE MANAGEMENT
  // ════════════════════════════════════════════════════════════════════════════

  const State = {
    initialized: false,
    processing: false,
    extensionValid: true,
    behavioralState: 'STANDARD',
    editMode: false,
    injectionTimeout: null,
    injectionCount: 0,
    lastContextData: null,
    skipNextClick: false, // Flag to prevent infinite loop when re-clicking send button
  };

  // Behavioral color palette for the Orb
  const BEHAVIORAL_COLORS = {
    FRUSTRATED:  { glow: '#ef4444', core: '#dc2626', pulse: 'fast',   icon: '🔥' },
    DEEP_STUDY:  { glow: '#a855f7', core: '#9333ea', pulse: 'slow',   icon: '🔮' },
    RESEARCH:    { glow: '#3b82f6', core: '#2563eb', pulse: 'medium', icon: '🔍' },
    CODING:      { glow: '#22c55e', core: '#16a34a', pulse: 'medium', icon: '💻' },
    CREATIVE:    { glow: '#f59e0b', core: '#d97706', pulse: 'slow',   icon: '✨' },
    URGENT:      { glow: '#f43f5e', core: '#e11d48', pulse: 'fast',   icon: '⚡' },
    STANDARD:    { glow: '#06b6d4', core: '#0891b2', pulse: 'slow',   icon: '⚡' },
  };

  console.log(`RAL Master Injector v${RAL_VERSION} loaded`);

  // ════════════════════════════════════════════════════════════════════════════
  //                          COMMUNICATION LAYER
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Robust message sender with extension context recovery
   */
  function sendMessage(message) {
    return new Promise((resolve) => {
      try {
        if (!chrome.runtime?.id) {
          console.warn('RAL: Extension context invalidated');
          State.extensionValid = false;
          resolve({ _extensionError: true });
          return;
        }

        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message || '';
            console.warn('RAL: Message error:', errorMsg);
            if (errorMsg.includes('invalidated') || errorMsg.includes('context')) {
              State.extensionValid = false;
              resolve({ _extensionError: true });
            } else {
              resolve(null);
            }
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        console.warn('RAL: Send failed:', e);
        State.extensionValid = false;
        resolve({ _extensionError: true });
      }
    });
  }

  async function getSettings() {
    const response = await sendMessage({ type: 'GET_SETTINGS' });
    return response || { enabled: true };
  }

  async function getContext(prompt = '', isEdit = false) {
    const response = await sendMessage({
      type: 'GET_CONTEXT',
      platform: PLATFORM,
      prompt: prompt,
      isEdit: isEdit,
    });
    if (response?._extensionError) {
      return { _extensionError: true, enabled: false };
    }
    State.lastContextData = response;
    return response || { enabled: false };
  }

  // ════════════════════════════════════════════════════════════════════════════
  //            FEATURE 1: FLICKER-FREE GHOST CONTEXT SCRUBBING
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Sets up MutationObserver to watch for and scrub reality_context XML
   * Uses hidden span technique to prevent any visual flicker
   */
  function setupGhostContextScrubber() {
    const scrubber = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Use requestAnimationFrame for smooth, flicker-free processing
            requestAnimationFrame(() => scrubContextFromElement(node));
          }
        }
      }
    });

    const container = document.querySelector('main') || document.body;
    scrubber.observe(container, { childList: true, subtree: true });

    // Initial scrub
    scrubContextFromElement(document.body);
    console.log('RAL v4.6: Flicker-Free Ghost Scrubber active');
  }

  /**
   * Walks the DOM tree and finds text nodes with context
   */
  function scrubContextFromElement(element) {
    if (!element?.querySelectorAll) return;

    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip already processed nodes
          if (node.parentNode?.classList?.contains('ral-ghost-hidden') ||
              node.parentNode?.classList?.contains('ral-context-badge')) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.textContent.includes('<reality_context')) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    const nodesToProcess = [];
    let textNode;
    while ((textNode = walker.nextNode())) {
      nodesToProcess.push(textNode);
    }

    nodesToProcess.forEach(scrubTextNode);
  }

  /**
   * FLICKER-FREE SCRUBBING:
   * 1. Wrap XML in hidden span (display: none)
   * 2. Insert badge immediately after
   * This prevents any flash of raw XML content
   */
  function scrubTextNode(textNode) {
    const parent = textNode.parentNode;
    if (!parent) return;

    const text = textNode.textContent;
    const contextRegex = /<reality_context[\s\S]*?<\/reality_context>/g;

    if (!contextRegex.test(text)) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    contextRegex.lastIndex = 0;
    let match;
    while ((match = contextRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      // Create HIDDEN span for the XML (preserves for AI, invisible to user)
      const hiddenSpan = document.createElement('span');
      hiddenSpan.className = 'ral-ghost-hidden';
      hiddenSpan.textContent = match[0];
      hiddenSpan.setAttribute('data-ral-context', 'true');
      fragment.appendChild(hiddenSpan);

      // Create SMART ADAPTIVE BADGE based on XML content
      const badge = createSmartBadge(match[0]);
      fragment.appendChild(badge);

      lastIndex = contextRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    parent.replaceChild(fragment, textNode);
    console.log('RAL v4.6: Ghost scrubbed (flicker-free)');
  }

  /**
   * SMART ADAPTIVE BADGE:
   * - Edit context: ✏️ Reality Updated
   * - Frustrated state: 🔥 Priority Anchored
   * - Normal: ⚓ Context Anchored
   */
  function createSmartBadge(xmlContent) {
    const badge = document.createElement('span');
    badge.className = 'ral-context-badge';

    // Determine badge type based on XML content
    let badgeIcon = '⚓';
    let badgeText = 'Context Anchored';
    let badgeClass = '';

    if (xmlContent.includes('type="edit_context"')) {
      badgeIcon = '✏️';
      badgeText = 'Reality Updated';
      badgeClass = 'ral-badge-edit';
    } else if (xmlContent.includes('behavioral_state="FRUSTRATED"') ||
               xmlContent.includes('FRUSTRATED') ||
               xmlContent.includes('frustration_level="HIGH"') ||
               xmlContent.includes('EMERGENCY')) {
      badgeText = 'Priority Anchored';
      badgeClass = 'ral-badge-priority';
    }

    badge.innerHTML = `<span class="ral-badge-icon">${badgeIcon}</span><span class="ral-badge-text">${badgeText}</span>`;
    badge.title = 'RAL context injected (hidden for clarity)';
    if (badgeClass) badge.classList.add(badgeClass);

    return badge;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //            FEATURE 2: BRUTE-FORCE REACT STATE SYNC
  // ════════════════════════════════════════════════════════════════════════════

  function getInputValue(element) {
    if (!element) return '';
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return element.value || '';
    }
    return element.innerText || element.textContent || '';
  }

  /**
   * Nuclear-grade input value setter with React compatibility
   * Uses multiple methods to ensure React state sync
   */
  function setInputValueWithReactSync(element, newValue) {
    if (!element) return false;

    try {
      element.focus();

      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        // Method 1: Native setter bypass
        const proto = element.tagName === 'TEXTAREA'
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

        if (nativeSetter) {
          nativeSetter.call(element, newValue);
        } else {
          element.value = newValue;
        }

        // Method 2: Comprehensive event dispatch
        element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        element.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: newValue,
        }));

      } else if (element.isContentEditable) {
        // For contenteditable: use execCommand
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);

        document.execCommand('insertText', false, newValue);

        // Fallback if execCommand didn't work
        if (element.innerText !== newValue) {
          element.innerText = newValue;
          element.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: newValue,
          }));
        }
      }

      // Trigger focus for React
      element.dispatchEvent(new Event('focus', { bubbles: true }));

      // Validate after a tick
      setTimeout(() => validateSendButtonState(element), 10);
      setTimeout(() => validateSendButtonState(element), 50);

      return true;

    } catch (e) {
      console.error('RAL v4.6: React sync error:', e);
      return false;
    }
  }

  /**
   * BRUTE-FORCE REACT SYNC:
   * If send button is still disabled, apply "Synthetic Tickle"
   * Append space then backspace to force React state update
   */
  function validateSendButtonState(inputElement) {
    const btn = findSendButton();
    const input = inputElement || findTextarea();

    if (!btn || !input) return;

    // Check if button is truly disabled
    const isDisabled = btn.disabled ||
                       btn.getAttribute('aria-disabled') === 'true' ||
                       btn.classList.contains('disabled');

    if (isDisabled && getInputValue(input).trim().length > 0) {
      console.log('RAL v4.6: Send button stuck - applying Synthetic Tickle...');
      applySyntheticTickle(input);
    }
  }

  /**
   * SYNTHETIC TICKLE:
   * The 100% reliable method to force ChatGPT's React to recognize changes
   * Append a space, then immediately "backspace" it away
   */
  function applySyntheticTickle(element) {
    if (!element) return;

    try {
      const currentValue = getInputValue(element);

      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        const proto = element.tagName === 'TEXTAREA'
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

        // Step 1: Add space
        if (nativeSetter) {
          nativeSetter.call(element, currentValue + ' ');
        }
        element.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: ' ',
        }));

        // Step 2: Remove space (simulate backspace)
        setTimeout(() => {
          if (nativeSetter) {
            nativeSetter.call(element, currentValue);
          }
          element.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            inputType: 'deleteContentBackward',
          }));
          console.log('RAL v4.6: Synthetic Tickle complete');
        }, 5);

      } else if (element.isContentEditable) {
        // For contenteditable
        const originalHTML = element.innerHTML;

        element.innerText = currentValue + ' ';
        element.dispatchEvent(new InputEvent('input', { bubbles: true }));

        setTimeout(() => {
          element.innerHTML = originalHTML;
          element.dispatchEvent(new InputEvent('input', { bubbles: true }));
        }, 5);
      }
    } catch (e) {
      console.warn('RAL v4.6: Synthetic Tickle failed:', e);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //            FEATURE 3: BEHAVIORAL ORB (POLISHED)
  // ════════════════════════════════════════════════════════════════════════════

  function createBehavioralOrb() {
    // Remove any existing indicators
    document.getElementById('ral-indicator')?.remove();
    document.getElementById('ral-behavioral-orb')?.remove();

    const orb = document.createElement('div');
    orb.id = 'ral-behavioral-orb';
    orb.className = 'ral-orb ral-orb-standard';
    orb.innerHTML = `
      <div class="ral-orb-glow"></div>
      <div class="ral-orb-core">
        <div class="ral-orb-icon">⚡</div>
      </div>
      <div class="ral-orb-ring"></div>
      <div class="ral-orb-label">RAL v${RAL_VERSION}</div>
      <div class="ral-orb-status">Ready</div>
      <div class="ral-orb-details">
        <div class="ral-orb-detail-row">
          <span class="ral-detail-label">Injections</span>
          <span class="ral-detail-value" id="ral-injection-count">0</span>
        </div>
        <div class="ral-orb-detail-row">
          <span class="ral-detail-label">State</span>
          <span class="ral-detail-value" id="ral-state-display">Standard</span>
        </div>
      </div>
    `;

    document.body.appendChild(orb);
    orb.addEventListener('click', toggleOrbExpanded);

    console.log('RAL v4.6: Behavioral Orb created (max z-index)');
  }

  function updateOrbState(behavioralState) {
    const orb = document.getElementById('ral-behavioral-orb');
    if (!orb) return;

    State.behavioralState = behavioralState || 'STANDARD';
    const config = BEHAVIORAL_COLORS[State.behavioralState] || BEHAVIORAL_COLORS.STANDARD;

    // Reset classes
    orb.className = 'ral-orb';
    orb.classList.add(`ral-orb-${State.behavioralState.toLowerCase()}`);
    orb.classList.add(`ral-pulse-${config.pulse}`);

    // Update CSS variables
    orb.style.setProperty('--orb-glow', config.glow);
    orb.style.setProperty('--orb-core', config.core);

    // Update icon and status
    const icon = orb.querySelector('.ral-orb-icon');
    if (icon) icon.textContent = config.icon;

    const status = orb.querySelector('.ral-orb-status');
    if (status) status.textContent = getStateLabel(State.behavioralState);

    const stateDisplay = document.getElementById('ral-state-display');
    if (stateDisplay) stateDisplay.textContent = State.behavioralState;
  }

  function getStateLabel(state) {
    const labels = {
      FRUSTRATED: 'Urgent Mode',
      DEEP_STUDY: 'Deep Study',
      RESEARCH: 'Research',
      CODING: 'Coding',
      CREATIVE: 'Creative',
      URGENT: 'Urgent',
      STANDARD: 'Ready',
    };
    return labels[state] || 'Ready';
  }

  function toggleOrbExpanded() {
    const orb = document.getElementById('ral-behavioral-orb');
    if (orb) orb.classList.toggle('ral-orb-expanded');
  }

  function flashOrb() {
    const orb = document.getElementById('ral-behavioral-orb');
    if (orb) {
      orb.classList.add('ral-orb-flash');
      setTimeout(() => orb.classList.remove('ral-orb-flash'), 600);
    }

    // Update injection count
    State.injectionCount++;
    const countEl = document.getElementById('ral-injection-count');
    if (countEl) countEl.textContent = State.injectionCount;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //            FEATURE 4: SMART RETRIES (LOADING STATE)
  // ════════════════════════════════════════════════════════════════════════════

  function showButtonLoadingState(button) {
    if (!button) return;

    button.setAttribute('data-ral-original', 'true');
    button.classList.add('ral-button-loading');

    const loader = document.createElement('span');
    loader.className = 'ral-button-loader';
    loader.innerHTML = `
      <span class="ral-loader-spinner"></span>
      <span class="ral-loader-text">Fusing Reality...</span>
    `;
    button.appendChild(loader);
    button.disabled = true;

    // Auto-restore after 5s timeout
    State.injectionTimeout = setTimeout(() => {
      restoreButtonState(button);
      console.log('RAL v4.6: Injection timeout, button restored');
    }, 5000);
  }

  function restoreButtonState(button) {
    if (!button) return;

    if (State.injectionTimeout) {
      clearTimeout(State.injectionTimeout);
      State.injectionTimeout = null;
    }

    button.querySelector('.ral-button-loader')?.remove();
    button.classList.remove('ral-button-loading');
    button.disabled = false;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //            FEATURE 5: EDIT MODE DETECTION
  // ════════════════════════════════════════════════════════════════════════════

  function setupEditModeDetection() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            checkForEditMode(node);
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log('RAL v4.6: Edit mode detection active');
  }

  function checkForEditMode(element) {
    if (!element?.matches) return;

    const editIndicators = [
      '[data-testid="edit-message"]',
      '[aria-label*="Edit"]',
      '[aria-label*="edit"]',
      '.edit-mode',
      '[class*="edit"]',
    ];

    const isEdit = editIndicators.some(selector =>
      element.matches?.(selector) || element.querySelector?.(selector)
    );

    if (isEdit) {
      State.editMode = true;
      console.log('RAL v4.6: Edit mode detected');

      const orb = document.getElementById('ral-behavioral-orb');
      if (orb) orb.classList.add('ral-orb-edit-mode');
    }
  }

  function resetEditMode() {
    State.editMode = false;
    const orb = document.getElementById('ral-behavioral-orb');
    if (orb) orb.classList.remove('ral-orb-edit-mode');
  }

  // ════════════════════════════════════════════════════════════════════════════
  //                          CONTEXT INJECTION
  // ════════════════════════════════════════════════════════════════════════════

  async function injectContext(element) {
    if (!element) return false;

    const currentValue = getInputValue(element);

    // Validation
    if (currentValue.trim().length < 3) {
      console.log('RAL v4.6: Message too short');
      return false;
    }

    if (currentValue.includes('<reality_context') ||
        currentValue.includes('[Context:') ||
        currentValue.includes('<context>')) {
      console.log('RAL v4.6: Already has context');
      return false;
    }

    // Get context from service worker
    const contextData = await getContext(currentValue, State.editMode);

    if (contextData?._extensionError) {
      console.log('RAL v4.6: Extension error, allowing through');
      return 'skip';
    }

    if (!contextData?.enabled) {
      console.log('RAL v4.6: Context disabled');
      return false;
    }

    // Build injection
    const contextString = contextData.contextString || '';
    const formatted = contextData.injection?.formatted || '';

    if (!contextString && !formatted) {
      console.log('RAL v4.6: No context available');
      return false;
    }

    let contextPrefix = formatted ||
      `<reality_context>\n${contextString}\n</reality_context>\n\n`;

    // Add edit context marker if in edit mode
    if (State.editMode) {
      contextPrefix = contextPrefix.replace('<reality_context', '<reality_context type="edit_context"');
    }

    // Add behavioral state marker if frustrated
    if (contextData.synthesis?.userIntent === 'FRUSTRATED' ||
        contextData.synthesis?.frustrationLevel === 'HIGH') {
      if (!contextPrefix.includes('behavioral_state=')) {
        contextPrefix = contextPrefix.replace('<reality_context', '<reality_context behavioral_state="FRUSTRATED"');
      }
    }

    const newValue = contextPrefix + currentValue;

    // Apply with React sync
    const success = setInputValueWithReactSync(element, newValue);

    if (success) {
      flashOrb();

      // Update orb state
      if (contextData.synthesis?.userIntent) {
        updateOrbState(contextData.synthesis.userIntent);
      } else if (contextData.synthesis?.frustrationLevel === 'HIGH') {
        updateOrbState('FRUSTRATED');
      }

      console.log('RAL v4.6: Context injected!');
    }

    return success;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //                          DOM HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  function findTextarea() {
    const selectors = [
      '#prompt-textarea',
      'div[contenteditable="true"][id="prompt-textarea"]',
      'textarea[data-id="root"]',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Send a message"]',
      'div[contenteditable="true"]',
      'form textarea',
      'main textarea',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.offsetParent !== null) return el;
    }

    // Fallback: any visible textarea
    for (const ta of document.querySelectorAll('textarea')) {
      if (ta.offsetParent !== null) return ta;
    }

    return null;
  }

  function findSendButton() {
    const selectors = [
      'button[data-testid="send-button"]',
      'button[data-testid="fruitjuice-send-button"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="send"]',
      'form button[type="submit"]',
      'button svg[data-icon="arrow-up"]',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        return el.tagName === 'BUTTON' ? el : el.closest('button');
      }
    }

    return null;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //                          EVENT HANDLERS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Check if content already has RAL context injected
   */
  function hasExistingContext(value) {
    return value.includes('<reality_context') ||
           value.includes('[Context:') ||
           value.includes('<context>');
  }

  async function handleKeyDown(event) {
    if (event._ralProcessed) return;
    if (event.key !== 'Enter' || event.shiftKey) return;

    const textarea = findTextarea();
    if (!textarea) return;

    // Check if in input area
    const isInInputArea =
      document.activeElement === textarea ||
      textarea.contains(document.activeElement) ||
      document.activeElement?.closest('#prompt-textarea') ||
      document.activeElement?.closest('form');

    if (!isInInputArea) return;

    const value = getInputValue(textarea);
    if (value.trim().length < 3) return;
    if (value.includes('<reality_context') || value.includes('[Context:')) return;

    // Intercept!
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    console.log('RAL v4.6: Enter intercepted, fusing reality...');

    // Show orb processing state
    const orb = document.getElementById('ral-behavioral-orb');
    if (orb) orb.classList.add('ral-orb-processing');

    const result = await injectContext(textarea);

    if (orb) orb.classList.remove('ral-orb-processing');

    // Handle result
    const triggerSend = () => {
      const btn = findSendButton();
      if (btn) {
        State.skipNextClick = true; // Prevent handleButtonClick from re-intercepting
        btn.click();
      } else {
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
          bubbles: true, cancelable: true,
        });
        enterEvent._ralProcessed = true;
        textarea.dispatchEvent(enterEvent);
      }
    };

    if (result === true) {
      setTimeout(triggerSend, 50);
    } else if (result === 'skip') {
      setTimeout(triggerSend, 10);
    } else {
      // Injection failed, re-dispatch
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
        bubbles: true, cancelable: true,
      });
      enterEvent._ralProcessed = true;
      textarea.dispatchEvent(enterEvent);
    }

    resetEditMode();
  }

  async function handleButtonClick(event) {
    // Skip if we're already processing or if this is a programmatic re-click
    if (State.processing) return;
    if (State.skipNextClick) {
      State.skipNextClick = false;
      return; // Let the native click through
    }

    const textarea = findTextarea();
    if (!textarea) return;

    const value = getInputValue(textarea);
    if (value.trim().length < 3) return;
    if (value.includes('<reality_context') || value.includes('[Context:')) return;

    // Check if extension context is still valid before processing
    if (!State.extensionValid || !chrome.runtime?.id) {
      console.log('RAL v4.6: Extension context invalid, allowing native send');
      return; // Let the native click through
    }

    State.processing = true;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const button = event.currentTarget || event.target?.closest('button');
    showButtonLoadingState(button);

    console.log('RAL v4.6: Button intercepted, fusing reality...');

    const result = await injectContext(textarea);

    restoreButtonState(button);
    State.processing = false;

    if (!result || result === 'skip') {
      // Set flag to skip next click and allow native behavior
      State.skipNextClick = true;
      setTimeout(() => {
        const btn = findSendButton();
        if (btn) btn.click();
      }, 10);
    }

    resetEditMode();
  }

  // ════════════════════════════════════════════════════════════════════════════
  //                          SETUP & INTERCEPTION
  // ════════════════════════════════════════════════════════════════════════════

  function setupInterception() {
    // Keyboard listener
    document.addEventListener('keydown', handleKeyDown, { capture: true });

    // Button watcher
    const observer = new MutationObserver(() => {
      const btn = findSendButton();
      if (btn && !btn.hasAttribute('data-ral-master')) {
        btn.setAttribute('data-ral-master', 'true');
        btn.addEventListener('click', handleButtonClick, { capture: true });
        console.log('RAL v4.6: Attached to send button');
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initial attachment
    const btn = findSendButton();
    if (btn) {
      btn.setAttribute('data-ral-master', 'true');
      btn.addEventListener('click', handleButtonClick, { capture: true });
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //                    CINEMATIC STYLES (v4.6 POLISH)
  // ════════════════════════════════════════════════════════════════════════════

  function injectStyles() {
    if (document.getElementById('ral-master-styles')) return;

    const style = document.createElement('style');
    style.id = 'ral-master-styles';
    style.textContent = `
      /* ═══════════════════════════════════════════════════════════════════════
         RAL MASTER INJECTOR v4.6 - CINEMATIC STYLES
         ═══════════════════════════════════════════════════════════════════════ */

      /* GHOST HIDDEN - XML is invisible but preserved */
      .ral-ghost-hidden {
        display: none !important;
        visibility: hidden !important;
        width: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
        position: absolute !important;
        pointer-events: none !important;
      }

      /* ═══════════════════════════════════════════════════════════════════════
         CYBERPUNK SMART BADGES - Project VOLTAGE Theme
         ═══════════════════════════════════════════════════════════════════════ */

      /* Base Badge - Acid Yellow on Void Black */
      .ral-context-badge {
        --badge-accent: #fcee0a;  /* Acid Yellow */
        --badge-accent-dim: rgba(252, 238, 10, 0.15);
        --badge-bg: #050505;
        --badge-border: #1a1a1a;
        
        display: inline-flex;
        align-items: center;
        gap: 8px;
        position: relative;
        background: var(--badge-bg);
        border: 1px solid var(--badge-accent);
        color: var(--badge-accent);
        padding: 6px 14px 6px 10px;
        font-size: 10px;
        font-weight: 700;
        font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        cursor: help;
        user-select: none;
        margin: 4px 6px;
        overflow: hidden;
        
        /* Cyberpunk corner cut */
        clip-path: polygon(
          0 0, 
          calc(100% - 10px) 0, 
          100% 10px, 
          100% 100%, 
          10px 100%, 
          0 calc(100% - 10px)
        );
        
        box-shadow: 
          0 0 8px var(--badge-accent-dim),
          inset 0 0 20px rgba(0, 0, 0, 0.5);
          
        animation: ral-cyber-materialize 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        transform-origin: left center;
      }
      
      /* Scanline overlay effect */
      .ral-badge-scanline {
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 0, 0, 0.15) 2px,
          rgba(0, 0, 0, 0.15) 4px
        );
        pointer-events: none;
        opacity: 0.5;
      }
      
      /* Badge prefix [R] */
      .ral-badge-prefix {
        background: var(--badge-accent);
        color: var(--badge-bg);
        padding: 2px 4px;
        font-size: 9px;
        font-weight: 800;
        margin-right: 2px;
        clip-path: polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%);
      }

      .ral-badge-text {
        text-shadow: 0 0 8px var(--badge-accent-dim);
        position: relative;
        z-index: 1;
      }
      
      /* Corner accent triangle */
      .ral-badge-corner {
        position: absolute;
        top: -1px;
        right: -1px;
        width: 10px;
        height: 10px;
        background: var(--badge-accent);
        clip-path: polygon(0 0, 100% 0, 100% 100%);
      }
      
      /* Glitch micro-text */
      .ral-badge-glitch {
        position: absolute;
        bottom: 2px;
        right: 12px;
        font-size: 6px;
        color: var(--badge-accent);
        opacity: 0.4;
        letter-spacing: 0.5px;
      }
      
      .ral-badge-glitch::before {
        content: attr(data-text);
      }

      /* Edit Context Badge - Hologram Cyan */
      .ral-context-badge.ral-badge-edit {
        --badge-accent: #00f0ff;  /* Hologram Cyan */
        --badge-accent-dim: rgba(0, 240, 255, 0.15);
        border-color: var(--badge-accent);
        color: var(--badge-accent);
      }
      
      .ral-context-badge.ral-badge-edit .ral-badge-prefix {
        background: var(--badge-accent);
      }
      
      .ral-context-badge.ral-badge-edit .ral-badge-corner {
        background: var(--badge-accent);
      }

      /* Priority/Frustrated Badge - Cyberpunk Red */
      .ral-context-badge.ral-badge-priority {
        --badge-accent: #ff003c;  /* Cyberpunk Red */
        --badge-accent-dim: rgba(255, 0, 60, 0.2);
        border-color: var(--badge-accent);
        color: var(--badge-accent);
        animation: 
          ral-cyber-materialize 0.4s cubic-bezier(0.16, 1, 0.3, 1),
          ral-priority-flicker 0.15s infinite;
      }
      
      .ral-context-badge.ral-badge-priority .ral-badge-prefix {
        background: var(--badge-accent);
        animation: ral-priority-blink 0.5s infinite;
      }
      
      .ral-context-badge.ral-badge-priority .ral-badge-corner {
        background: var(--badge-accent);
      }
      
      /* Research Badge - Data Cyan with pulse */
      .ral-context-badge.ral-badge-research {
        --badge-accent: #00f0ff;
        --badge-accent-dim: rgba(0, 240, 255, 0.15);
        border-color: var(--badge-accent);
        color: var(--badge-accent);
      }
      
      .ral-context-badge.ral-badge-research .ral-badge-prefix {
        background: var(--badge-accent);
      }
      
      .ral-context-badge.ral-badge-research .ral-badge-corner {
        background: var(--badge-accent);
      }

      /* CYBERPUNK MATERIALIZE - Glitch in from left */
      @keyframes ral-cyber-materialize {
        0% {
          opacity: 0;
          transform: translateX(-20px) skewX(-5deg);
          filter: blur(4px);
        }
        30% {
          opacity: 1;
          transform: translateX(3px) skewX(2deg);
          filter: blur(0);
        }
        50% {
          transform: translateX(-2px) skewX(-1deg);
        }
        70% {
          transform: translateX(1px) skewX(0.5deg);
        }
        100% {
          opacity: 1;
          transform: translateX(0) skewX(0);
          filter: blur(0);
        }
      }

      /* Priority flicker effect */
      @keyframes ral-priority-flicker {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.92; }
        75% { opacity: 0.97; }
      }
      
      @keyframes ral-priority-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      
      /* Hover state - intensify glow */
      .ral-context-badge:hover {
        box-shadow: 
          0 0 15px var(--badge-accent-dim),
          0 0 30px var(--badge-accent-dim),
          inset 0 0 20px rgba(0, 0, 0, 0.5);
      }
      
      .ral-context-badge:hover .ral-badge-text {
        text-shadow: 0 0 12px var(--badge-accent);
      }

      /* ═══════════════════════════════════════════════════════════════════════
         BEHAVIORAL ORB - MAX Z-INDEX, POLISHED
         ═══════════════════════════════════════════════════════════════════════ */

      .ral-orb {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 56px;
        height: 56px;
        z-index: ${MAX_Z_INDEX};
        cursor: pointer;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        --orb-glow: #06b6d4;
        --orb-core: #0891b2;
      }

      .ral-orb-glow {
        position: absolute;
        inset: -10px;
        background: radial-gradient(circle, var(--orb-glow) 0%, transparent 70%);
        border-radius: 50%;
        opacity: 0.6;
        filter: blur(10px);
        animation: ral-orb-glow 3s ease-in-out infinite;
        pointer-events: none; /* CRITICAL: Prevents click interference */
      }

      .ral-orb-core {
        position: absolute;
        inset: 8px;
        background: linear-gradient(135deg, var(--orb-core), color-mix(in srgb, var(--orb-core) 60%, black));
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow:
          0 4px 24px rgba(0,0,0,0.35),
          inset 0 2px 12px rgba(255,255,255,0.25);
        z-index: 2;
      }

      .ral-orb-icon {
        font-size: 22px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        z-index: 3;
      }

      .ral-orb-ring {
        position: absolute;
        inset: 4px;
        border: 2px solid var(--orb-glow);
        border-radius: 50%;
        opacity: 0.5;
        animation: ral-orb-ring 4s linear infinite;
        pointer-events: none;
      }

      .ral-orb-label {
        position: absolute;
        bottom: -22px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 9px;
        font-weight: 700;
        color: #94a3b8;
        white-space: nowrap;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        opacity: 0;
        transition: opacity 0.3s;
        pointer-events: none;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      }

      .ral-orb:hover .ral-orb-label {
        opacity: 1;
      }

      .ral-orb-status {
        position: absolute;
        top: -10px;
        right: -10px;
        background: linear-gradient(135deg, #1e293b, #334155);
        color: white;
        font-size: 9px;
        font-weight: 700;
        padding: 4px 8px;
        border-radius: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-shadow: 0 2px 10px rgba(0,0,0,0.4);
        opacity: 0;
        transform: scale(0.8) translateY(4px);
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        z-index: 4;
      }

      .ral-orb:hover .ral-orb-status {
        opacity: 1;
        transform: scale(1) translateY(0);
      }

      /* Orb Details Panel */
      .ral-orb-details {
        position: absolute;
        bottom: 70px;
        right: 0;
        background: linear-gradient(135deg, #1e293b, #0f172a);
        border-radius: 12px;
        padding: 12px 16px;
        min-width: 160px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        opacity: 0;
        transform: translateY(10px) scale(0.95);
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        pointer-events: none;
        z-index: 5;
      }

      .ral-orb.ral-orb-expanded .ral-orb-details {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      .ral-orb-detail-row {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        font-size: 11px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      .ral-detail-label {
        color: #94a3b8;
      }

      .ral-detail-value {
        color: white;
        font-weight: 600;
      }

      /* State Variations */
      .ral-orb-frustrated { --orb-glow: #ef4444; --orb-core: #dc2626; }
      .ral-orb-frustrated .ral-orb-glow { animation-duration: 0.5s; }

      .ral-orb-deep_study { --orb-glow: #a855f7; --orb-core: #9333ea; }
      .ral-orb-research { --orb-glow: #3b82f6; --orb-core: #2563eb; }
      .ral-orb-coding { --orb-glow: #22c55e; --orb-core: #16a34a; }
      .ral-orb-creative { --orb-glow: #f59e0b; --orb-core: #d97706; }
      .ral-orb-urgent { --orb-glow: #f43f5e; --orb-core: #e11d48; }

      /* Processing State */
      .ral-orb-processing .ral-orb-ring {
        animation: ral-orb-ring-fast 0.5s linear infinite;
        border-color: white;
        border-width: 3px;
      }

      /* Flash Effect */
      .ral-orb-flash .ral-orb-core {
        animation: ral-orb-flash 0.6s ease-out;
      }

      /* Edit Mode Indicator */
      .ral-orb-edit-mode::after {
        content: '✏️';
        position: absolute;
        top: -6px;
        left: -6px;
        font-size: 16px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
        z-index: 10;
      }

      /* Orb Animations */
      @keyframes ral-orb-glow {
        0%, 100% { opacity: 0.6; transform: scale(1); }
        50% { opacity: 0.85; transform: scale(1.12); }
      }

      @keyframes ral-orb-ring {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      @keyframes ral-orb-ring-fast {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      @keyframes ral-orb-flash {
        0% { transform: scale(1); filter: brightness(1); }
        50% { transform: scale(1.25); filter: brightness(1.6); }
        100% { transform: scale(1); filter: brightness(1); }
      }

      /* Pulse Variations */
      .ral-pulse-slow .ral-orb-glow { animation-duration: 4s; }
      .ral-pulse-medium .ral-orb-glow { animation-duration: 2s; }
      .ral-pulse-fast .ral-orb-glow { animation-duration: 0.5s; }

      /* ═══════════════════════════════════════════════════════════════════════
         BUTTON LOADING STATE
         ═══════════════════════════════════════════════════════════════════════ */

      .ral-button-loading {
        position: relative !important;
        pointer-events: none !important;
      }

      .ral-button-loader {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        border-radius: inherit;
        z-index: 10;
        animation: ral-loader-materialize 0.3s ease-out;
      }

      @keyframes ral-loader-materialize {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
      }

      .ral-loader-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: ral-spin 0.7s linear infinite;
      }

      .ral-loader-text {
        color: white;
        font-size: 11px;
        font-weight: 700;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: 0.3px;
      }

      @keyframes ral-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;

    document.head.appendChild(style);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //                          INITIALIZATION
  // ════════════════════════════════════════════════════════════════════════════

  async function init() {
    if (State.initialized) return;

    console.log(`RAL Master Injector v${RAL_VERSION}: Initializing...`);

    const settings = await getSettings();

    if (!settings || settings.enabled === false) {
      console.log('RAL: Extension disabled');
      return;
    }

    // Inject styles first (before any DOM manipulation)
    injectStyles();

    // Create UI
    createBehavioralOrb();

    // Setup all handlers
    setupInterception();
    setupGhostContextScrubber();
    setupEditModeDetection();

    State.initialized = true;
    console.log(`RAL Master Injector v${RAL_VERSION}: Ready! 🧠⚡`);
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Handle SPA navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      State.initialized = false;
      setTimeout(init, 500);
    }
  }).observe(document, { subtree: true, childList: true });

})();
