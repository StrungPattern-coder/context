/**
 * RAL JavaScript SDK - Universal Integration
 * 
 * A lightweight JavaScript/TypeScript SDK for integrating RAL
 * with any AI provider (OpenAI, Anthropic, Google, etc.)
 * 
 * @example
 * import { RAL } from 'ral-sdk';
 * 
 * const ral = new RAL({ serverUrl: 'https://your-ral-server.com' });
 * const result = await ral.augment('What should I do next?', { provider: 'openai' });
 * 
 * @version 0.1.0
 */

// ========================================
// Types
// ========================================

/**
 * Supported AI providers
 */
export type Provider = 
  | 'openai' 
  | 'anthropic' 
  | 'google' 
  | 'perplexity' 
  | 'cohere' 
  | 'mistral' 
  | 'llama' 
  | 'generic';

/**
 * Contextual signals for augmentation
 */
export interface ContextSignals {
  timezone?: string;
  locale?: string;
  location?: string;
  device?: string;
  sessionContext?: string;
}

/**
 * Augmentation options
 */
export interface AugmentOptions {
  provider?: Provider;
  signals?: ContextSignals;
  includeTemporal?: boolean;
  includeSpatial?: boolean;
  includePreferences?: boolean;
}

/**
 * RAL augmentation response
 */
export interface RALResponse {
  systemContext: string;
  userPrompt: string;
  augmentedPrompt?: string;
  metadata: Record<string, unknown>;
}

/**
 * RAL SDK configuration
 */
export interface RALConfig {
  serverUrl: string;
  userId?: string;
  timeout?: number;
  autoDetect?: boolean;
}

// ========================================
// RAL SDK Class
// ========================================

/**
 * RAL SDK - Context-aware AI augmentation
 * 
 * @example
 * const ral = new RAL({ serverUrl: 'https://ral.example.com' });
 * const response = await ral.augment('What should I do today?');
 */
export class RAL {
  private serverUrl: string;
  private userId: string;
  private timeout: number;
  private autoDetect: boolean;
  private signalsCache: ContextSignals | null = null;

  constructor(config: RALConfig) {
    this.serverUrl = config.serverUrl.replace(/\/$/, '');
    this.userId = config.userId || 'default';
    this.timeout = config.timeout || 30000;
    this.autoDetect = config.autoDetect !== false;

    if (!this.serverUrl) {
      throw new RALError('serverUrl is required');
    }
  }

  /**
   * Augment a prompt with contextual awareness
   * 
   * @param prompt - The user's original prompt
   * @param options - Augmentation options
   * @returns RAL response with augmented context
   * 
   * @example
   * const result = await ral.augment('What meetings do I have?', {
   *   provider: 'openai',
   *   includeTemporal: true
   * });
   */
  async augment(prompt: string, options: AugmentOptions = {}): Promise<RALResponse> {
    const {
      provider = 'generic',
      signals = this.autoDetect ? this.detectSignals() : {},
      includeTemporal = true,
      includeSpatial = true,
      includePreferences = true
    } = options;

    const payload = {
      prompt,
      user_id: this.userId,
      provider,
      signals: this.normalizeSignals(signals),
      options: {
        include_temporal: includeTemporal,
        include_spatial: includeSpatial,
        include_preferences: includePreferences
      }
    };

    const data = await this.request('POST', '/api/v0/universal/augment', payload);
    
    return {
      systemContext: String(data.system_context || ''),
      userPrompt: String(data.user_prompt || prompt),
      augmentedPrompt: data.augmented_prompt ? String(data.augmented_prompt) : undefined,
      metadata: (data.metadata as Record<string, unknown>) || {}
    };
  }

  /**
   * Get current context without augmentation
   * 
   * @param signals - Optional context signals
   * @returns Current context information
   */
  async getContext(signals?: ContextSignals): Promise<Record<string, unknown>> {
    const effectiveSignals = signals || (this.autoDetect ? this.detectSignals() : {});
    
    const params = new URLSearchParams();
    params.set('user_id', this.userId);
    
    if (effectiveSignals.timezone) {
      params.set('timezone', effectiveSignals.timezone);
    }
    if (effectiveSignals.location) {
      params.set('location', effectiveSignals.location);
    }

    return this.request('GET', `/api/v0/universal/context?${params.toString()}`);
  }

  /**
   * Check server health
   * 
   * @returns True if server is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const data = await this.request('GET', '/health');
      return data?.status === 'healthy';
    } catch {
      return false;
    }
  }

  /**
   * Auto-detect contextual signals from browser/environment
   */
  detectSignals(): ContextSignals {
    if (this.signalsCache) {
      return this.signalsCache;
    }

    const signals: ContextSignals = {};

    // Timezone
    try {
      signals.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // Fallback
    }

    // Locale
    try {
      signals.locale = navigator?.language || 'en-US';
    } catch {
      signals.locale = 'en-US';
    }

    // Device info
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      if (ua.includes('Mobile')) {
        signals.device = 'mobile';
      } else if (ua.includes('Tablet')) {
        signals.device = 'tablet';
      } else {
        signals.device = 'desktop';
      }
    }

    this.signalsCache = signals;
    return signals;
  }

  /**
   * Normalize signals for API (convert camelCase to snake_case)
   */
  private normalizeSignals(signals: ContextSignals): Record<string, string> {
    const result: Record<string, string> = {};
    if (signals.timezone) result.timezone = signals.timezone;
    if (signals.locale) result.locale = signals.locale;
    if (signals.location) result.location = signals.location;
    if (signals.device) result.device = signals.device;
    if (signals.sessionContext) result.session_context = signals.sessionContext;
    return result;
  }

  /**
   * Make HTTP request to RAL server
   */
  private async request(
    method: string, 
    endpoint: string, 
    payload?: unknown
  ): Promise<Record<string, unknown>> {
    const url = `${this.serverUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-RAL-User-ID': this.userId
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        throw new RALError(`HTTP ${response.status}: ${text}`, response.status);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof RALError) {
        throw error;
      }
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new RALError('Request timeout');
        }
        throw new RALError(`Connection error: ${error.message}`);
      }
      
      throw new RALError('Unknown error');
    }
  }
}

// ========================================
// Error Class
// ========================================

/**
 * RAL SDK Error
 */
export class RALError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'RALError';
    this.statusCode = statusCode;
  }
}

// ========================================
// Provider Helpers
// ========================================

/**
 * Helper for OpenAI integration
 */
export const OpenAIHelper = {
  /**
   * Build OpenAI messages array with RAL context
   */
  buildMessages(
    response: RALResponse, 
    history: Array<{ role: string; content: string }> = []
  ): Array<{ role: string; content: string }> {
    return [
      { role: 'system', content: response.systemContext },
      ...history,
      { role: 'user', content: response.userPrompt }
    ];
  }
};

/**
 * Helper for Anthropic Claude integration
 */
export const AnthropicHelper = {
  /**
   * Build Anthropic API request with RAL context
   */
  buildRequest(
    response: RALResponse,
    options: {
      model?: string;
      maxTokens?: number;
      history?: Array<{ role: string; content: string }>;
    } = {}
  ): Record<string, unknown> {
    const { 
      model = 'claude-3-opus-20240229', 
      maxTokens = 4096,
      history = []
    } = options;

    return {
      model,
      max_tokens: maxTokens,
      system: response.systemContext,
      messages: [
        ...history,
        { role: 'user', content: response.userPrompt }
      ]
    };
  }
};

/**
 * Helper for Google Gemini integration
 */
export const GoogleHelper = {
  /**
   * Build Google Gemini contents with RAL context
   */
  buildContents(
    response: RALResponse,
    history: Array<{ role: string; content: string }> = []
  ): Array<{ role: string; parts: Array<{ text: string }> }> {
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
      {
        role: 'user',
        parts: [{ text: `System context: ${response.systemContext}` }]
      },
      {
        role: 'model',
        parts: [{ text: 'I understand the context. How can I help you?' }]
      }
    ];

    // Add history
    for (const msg of history) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }

    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: response.userPrompt }]
    });

    return contents;
  }
};

// ========================================
// Factory Function
// ========================================

/**
 * Quick RAL instance creation
 * 
 * @example
 * const ral = createRAL('https://ral.example.com');
 * const result = await ral.augment('Hello');
 */
export function createRAL(serverUrl: string, userId?: string): RAL {
  return new RAL({ serverUrl, userId });
}

// ========================================
// Default Export
// ========================================

export default RAL;
