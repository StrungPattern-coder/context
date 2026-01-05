/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *         RAL MASTER INJECTOR - Gemini v4.6 (Single Source of Truth)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * The definitive, self-contained Gemini integration. Zero external dependencies.
 * 
 * @version 4.6.0
 * @license MIT
 */

(function() {
  'use strict';

  const RAL_VERSION = '4.6.0';
  const PLATFORM = 'gemini';
  const MAX_Z_INDEX = 2147483647;

  const State = {
    initialized: false,
    processing: false,
    extensionValid: true,
    behavioralState: 'STANDARD',
    editMode: false,
    injectionCount: 0,
  };

  const BEHAVIORAL_COLORS = {
    FRUSTRATED:  { glow: '#ef4444', core: '#dc2626', icon: '🔥' },
    RESEARCH:    { glow: '#3b82f6', core: '#2563eb', icon: '🔍' },
    CODING:      { glow: '#22c55e', core: '#16a34a', icon: '💻' },
    STANDARD:    { glow: '#06b6d4', core: '#0891b2', icon: '⚡' },
  };

  console.log(`RAL Master Injector v${RAL_VERSION} [Gemini] loaded`);

  // ════════════════════════════════════════════════════════════════════════════
  //                          COMMUNICATION LAYER
  // ════════════════════════════════════════════════════════════════════════════

  function sendMessage(message) {
    return new Promise((resolve) => {
      try {
        if (!chrome.runtime?.id) {
          State.extensionValid = false;
          resolve({ _extensionError: true });
          return;
        }
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve(chrome.runtime.lastError.message?.includes('invalidated') ? { _extensionError: true } : null);
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        resolve({ _extensionError: true });
      }
    });
  }

  async function getSettings() {
    return await sendMessage({ type: 'GET_SETTINGS' }) || { enabled: true };
  }

  async function getContext(prompt = '', isEdit = false) {
    const response = await sendMessage({ type: 'GET_CONTEXT', platform: PLATFORM, prompt, isEdit });
    return response?._extensionError ? { _extensionError: true, enabled: false } : response || { enabled: false };
  }

  // ════════════════════════════════════════════════════════════════════════════
  //            FLICKER-FREE GHOST CONTEXT SCRUBBING
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
            requestAnimationFrame(() => scrubContextFromElement(node));
          }
        }
      }
    });

    const container = document.querySelector('[class*="conversation"]') || document.querySelector('main') || document.body;
    scrubber.observe(container, { childList: true, subtree: true });

    // Initial scrub
    scrubContextFromElement(document.body);
    console.log('RAL v4.6 [Gemini]: Flicker-Free Ghost Scrubber active');
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
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      const hiddenSpan = document.createElement('span');
      hiddenSpan.className = 'ral-ghost-hidden';
      hiddenSpan.textContent = match[0];
      hiddenSpan.setAttribute('data-ral-context', 'true');
      fragment.appendChild(hiddenSpan);

      const badge = createSmartBadge(match[0]);
      fragment.appendChild(badge);

      lastIndex = contextRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    parent.replaceChild(fragment, textNode);
  }

  /**
   * SMART ADAPTIVE BADGE
   */
  function createSmartBadge(xmlContent) {
    const badge = document.createElement('span');
    badge.className = 'ral-context-badge';

    let badgeIcon = '⚓';
    let badgeText = 'Context Anchored';
    let badgeClass = '';

    if (xmlContent.includes('type="edit_context"')) {
      badgeIcon = '✏️';
      badgeText = 'Reality Updated';
      badgeClass = 'ral-badge-edit';
    } else if (xmlContent.includes('FRUSTRATED') ||
               xmlContent.includes('frustration_level="HIGH"') ||
               xmlContent.includes('EMERGENCY')) {
      badgeIcon = '🔥';
      badgeText = 'Priority Anchored';
      badgeClass = 'ral-badge-priority';
    }

    badge.innerHTML = `<span class="ral-badge-icon">${badgeIcon}</span><span class="ral-badge-text">${badgeText}</span>`;
    badge.title = 'RAL context injected (hidden for clarity)';
    if (badgeClass) badge.classList.add(badgeClass);

    return badge;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //                          INPUT HANDLING
  // ════════════════════════════════════════════════════════════════════════════

  function getInputValue(element) {
    if (!element) return '';
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') return element.value || '';
    return element.innerText || element.textContent || '';
  }

  function setInputValueWithSync(element, newValue) {
    if (!element) return false;
    try {
      element.focus();

      if (element.isContentEditable) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, newValue);

        if (getInputValue(element) !== newValue) {
          element.innerText = newValue;
          element.dispatchEvent(new InputEvent('input', { bubbles: true }));
        }
      } else {
        const proto = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (nativeSetter) nativeSetter.call(element, newValue);
        else element.value = newValue;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //                          BEHAVIORAL ORB
  // ════════════════════════════════════════════════════════════════════════════

  function createBehavioralOrb() {
    document.getElementById('ral-behavioral-orb')?.remove();

    const orb = document.createElement('div');
    orb.id = 'ral-behavioral-orb';
    orb.className = 'ral-orb ral-orb-standard';
    orb.innerHTML = `
      <div class="ral-orb-glow"></div>
      <div class="ral-orb-core"><div class="ral-orb-icon">⚡</div></div>
      <div class="ral-orb-ring"></div>
      <div class="ral-orb-label">RAL v${RAL_VERSION}</div>
      <div class="ral-orb-status">Ready</div>
    `;
    document.body.appendChild(orb);
  }

  function flashOrb() {
    const orb = document.getElementById('ral-behavioral-orb');
    if (orb) {
      orb.classList.add('ral-orb-flash');
      setTimeout(() => orb.classList.remove('ral-orb-flash'), 600);
    }
    State.injectionCount++;
  }

  function updateOrbState(behavioralState) {
    const orb = document.getElementById('ral-behavioral-orb');
    if (!orb) return;

    State.behavioralState = behavioralState || 'STANDARD';
    const config = BEHAVIORAL_COLORS[State.behavioralState] || BEHAVIORAL_COLORS.STANDARD;

    orb.className = 'ral-orb';
    orb.classList.add(`ral-orb-${State.behavioralState.toLowerCase()}`);
    orb.style.setProperty('--orb-glow', config.glow);
    orb.style.setProperty('--orb-core', config.core);

    const icon = orb.querySelector('.ral-orb-icon');
    if (icon) icon.textContent = config.icon;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //                          CONTEXT INJECTION
  // ════════════════════════════════════════════════════════════════════════════

  const RAL_CONTEXT_MARKER = '<!-- RAL -->';

  function hasExistingContext(value) {
    return value.includes('<reality_context') || value.includes(RAL_CONTEXT_MARKER) ||
           value.includes('[Context:') || value.includes('<task_context>');
  }

  async function injectContext(element) {
    if (!element) return false;
    const currentValue = getInputValue(element);
    if (currentValue.trim().length < 3 || hasExistingContext(currentValue)) return false;

    const contextData = await getContext(currentValue, State.editMode);
    if (contextData?._extensionError) return 'skip';
    if (!contextData?.enabled) return false;

    const contextString = contextData.contextString || '';
    const formatted = contextData.injection?.formatted || '';
    if (!contextString && !formatted) return false;

    let contextPrefix = formatted 
      ? RAL_CONTEXT_MARKER + '\n' + formatted + '\n\n'
      : `${RAL_CONTEXT_MARKER}\n<reality_context>\n${contextString}\n</reality_context>\n\n`;

    if (contextData.synthesis?.frustrationLevel === 'HIGH') {
      contextPrefix = contextPrefix.replace('<reality_context', '<reality_context behavioral_state="FRUSTRATED"');
    }

    const success = setInputValueWithSync(element, contextPrefix + currentValue);
    if (success) {
      flashOrb();
      if (contextData.synthesis?.userIntent) updateOrbState(contextData.synthesis.userIntent);
      console.log('RAL v4.6 [Gemini]: Context injected!');
    }
    return success;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //                          DOM HELPERS (GEMINI-SPECIFIC)
  // ════════════════════════════════════════════════════════════════════════════

  function findInput() {
    const selectors = [
      // Gemini's rich text editor
      'rich-textarea .ql-editor[contenteditable="true"]',
      'rich-textarea [contenteditable="true"]',
      '.ql-editor[contenteditable="true"]',
      // Fallback selectors
      'div[contenteditable="true"][aria-label*="prompt"]',
      'div[contenteditable="true"][aria-label*="message"]',
      'textarea[placeholder*="message"]',
      'textarea[aria-label*="prompt"]',
      'div[contenteditable="true"]',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.offsetParent !== null) return el;
    }
    return null;
  }

  function findSendButton() {
    const selectors = [
      'button[aria-label*="Send"]',
      'button[aria-label*="send"]',
      'button[data-test-id="send-button"]',
      'button.send-button',
      'button[type="submit"]',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el.tagName === 'BUTTON' ? el : el.closest('button');
    }

    // Find button near input with SVG icon
    const input = findInput();
    if (input) {
      const container = input.closest('form') || input.parentElement?.parentElement?.parentElement;
      if (container) {
        const buttons = container.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.querySelector('svg') && btn.offsetParent !== null) return btn;
        }
      }
    }
    return null;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //                          EVENT HANDLERS
  // ════════════════════════════════════════════════════════════════════════════

  async function handleKeyDown(event) {
    if (event._ralProcessed || State.processing || event.key !== 'Enter' || event.shiftKey) return;

    const input = findInput();
    if (!input) return;

    const isInInputArea = document.activeElement === input || input.contains(document.activeElement);
    if (!isInInputArea) return;

    const value = getInputValue(input);
    if (value.trim().length < 3 || hasExistingContext(value)) return;

    State.processing = true;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const orb = document.getElementById('ral-behavioral-orb');
    if (orb) orb.classList.add('ral-orb-processing');

    try {
      const result = await injectContext(input);
      if (orb) orb.classList.remove('ral-orb-processing');

      const triggerSend = () => {
        State.processing = false;
        const btn = findSendButton();
        if (btn && !btn.disabled) {
          const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
          clickEvent._ralProcessed = true;
          btn.dispatchEvent(clickEvent);
        }
      };

      if (result === true || result === 'skip') {
        setTimeout(triggerSend, result === true ? 100 : 50);
      } else {
        State.processing = false;
        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true });
        enterEvent._ralProcessed = true;
        input.dispatchEvent(enterEvent);
      }
    } catch (error) {
      State.processing = false;
      if (orb) orb.classList.remove('ral-orb-processing');
    }
  }

  async function handleButtonClick(event) {
    if (event._ralProcessed || State.processing) return;

    const input = findInput();
    if (!input) return;

    const value = getInputValue(input);
    if (value.trim().length < 3 || hasExistingContext(value)) return;

    State.processing = true;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    await injectContext(input);

    setTimeout(() => {
      State.processing = false;
      const btn = findSendButton();
      if (btn && !btn.disabled) {
        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
        clickEvent._ralProcessed = true;
        btn.dispatchEvent(clickEvent);
      }
    }, 100);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //                          SETUP & STYLES
  // ════════════════════════════════════════════════════════════════════════════

  function setupInterception() {
    document.addEventListener('keydown', handleKeyDown, { capture: true });

    const observer = new MutationObserver(() => {
      const btn = findSendButton();
      if (btn && !btn.hasAttribute('data-ral-master')) {
        btn.setAttribute('data-ral-master', 'true');
        btn.addEventListener('click', handleButtonClick, { capture: true });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const btn = findSendButton();
    if (btn) {
      btn.setAttribute('data-ral-master', 'true');
      btn.addEventListener('click', handleButtonClick, { capture: true });
    }
  }

  function injectStyles() {
    if (document.getElementById('ral-master-styles')) return;

    const style = document.createElement('style');
    style.id = 'ral-master-styles';
    style.textContent = `
      .ral-ghost-hidden {
        display: none !important;
        visibility: hidden !important;
        width: 0 !important;
        height: 0 !important;
        position: absolute !important;
        pointer-events: none !important;
      }

      .ral-context-badge {
        --badge-accent: #fcee0a;
        --badge-accent-dim: rgba(252, 238, 10, 0.15);
        --badge-bg: #050505;
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
        font-family: 'JetBrains Mono', monospace;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        cursor: help;
        margin: 4px 6px;
        clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
        box-shadow: 0 0 8px var(--badge-accent-dim);
        animation: ral-cyber-materialize 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }
      
      .ral-badge-scanline {
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.15) 2px, rgba(0, 0, 0, 0.15) 4px);
        pointer-events: none;
        opacity: 0.5;
      }
      
      .ral-badge-prefix {
        background: var(--badge-accent);
        color: var(--badge-bg);
        padding: 2px 4px;
        font-size: 9px;
        font-weight: 800;
        clip-path: polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%);
      }

      .ral-badge-text { text-shadow: 0 0 8px var(--badge-accent-dim); }
      
      .ral-badge-corner {
        position: absolute;
        top: -1px;
        right: -1px;
        width: 10px;
        height: 10px;
        background: var(--badge-accent);
        clip-path: polygon(0 0, 100% 0, 100% 100%);
      }
      
      .ral-badge-glitch {
        position: absolute;
        bottom: 2px;
        right: 12px;
        font-size: 6px;
        color: var(--badge-accent);
        opacity: 0.4;
      }
      .ral-badge-glitch::before { content: attr(data-text); }

      .ral-context-badge.ral-badge-edit { --badge-accent: #00f0ff; }
      .ral-context-badge.ral-badge-priority {
        --badge-accent: #ff003c;
        animation: ral-cyber-materialize 0.4s, ral-priority-flicker 0.15s infinite;
      }
      .ral-context-badge.ral-badge-research { --badge-accent: #00f0ff; }

      @keyframes ral-cyber-materialize {
        0% { opacity: 0; transform: translateX(-20px) skewX(-5deg); }
        100% { opacity: 1; transform: translateX(0) skewX(0); }
      }

      @keyframes ral-priority-flicker {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.92; }
      }

      .ral-orb {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 56px;
        height: 56px;
        z-index: ${MAX_Z_INDEX};
        cursor: pointer;
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
        pointer-events: none;
      }

      .ral-orb-core {
        position: absolute;
        inset: 8px;
        background: linear-gradient(135deg, var(--orb-core), color-mix(in srgb, var(--orb-core) 60%, black));
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 24px rgba(0,0,0,0.35);
        z-index: 2;
      }

      .ral-orb-icon { font-size: 22px; z-index: 3; }

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
        color: #94a3b8;
        opacity: 0;
        transition: opacity 0.3s;
        pointer-events: none;
      }

      .ral-orb:hover .ral-orb-label { opacity: 1; }

      .ral-orb-status {
        position: absolute;
        top: -10px;
        right: -10px;
        background: linear-gradient(135deg, #1e293b, #334155);
        color: white;
        font-size: 9px;
        padding: 4px 8px;
        border-radius: 10px;
        opacity: 0;
        transition: all 0.3s;
        z-index: 4;
      }

      .ral-orb:hover .ral-orb-status { opacity: 1; }

      .ral-orb-frustrated { --orb-glow: #ef4444; --orb-core: #dc2626; }
      .ral-orb-research { --orb-glow: #3b82f6; --orb-core: #2563eb; }
      .ral-orb-coding { --orb-glow: #22c55e; --orb-core: #16a34a; }

      .ral-orb-processing .ral-orb-ring {
        animation: ral-orb-ring 0.5s linear infinite;
        border-color: white;
        border-width: 3px;
      }

      .ral-orb-flash .ral-orb-core {
        animation: ral-orb-flash 0.6s ease-out;
      }

      @keyframes ral-orb-glow {
        0%, 100% { opacity: 0.6; transform: scale(1); }
        50% { opacity: 0.85; transform: scale(1.12); }
      }

      @keyframes ral-orb-ring {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      @keyframes ral-orb-flash {
        0% { transform: scale(1); }
        50% { transform: scale(1.25); filter: brightness(1.6); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //                          INITIALIZATION
  // ════════════════════════════════════════════════════════════════════════════

  async function init() {
    if (State.initialized) return;

    const settings = await getSettings();
    if (!settings || settings.enabled === false) return;

    injectStyles();
    createBehavioralOrb();
    setupInterception();
    setupGhostContextScrubber();

    State.initialized = true;
    console.log(`RAL Master Injector v${RAL_VERSION} [Gemini]: Ready! 🧠⚡`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      State.initialized = false;
      setTimeout(init, 500);
    }
  }).observe(document, { subtree: true, childList: true });

})();
