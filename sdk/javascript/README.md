# RAL JavaScript SDK

Context-aware AI augmentation for any AI provider.

## Installation

```bash
npm install ral-sdk
# or
yarn add ral-sdk
# or
pnpm add ral-sdk
```

## Quick Start

```typescript
import { RAL } from 'ral-sdk';

// Initialize
const ral = new RAL({ 
  serverUrl: 'https://your-ral-server.com',
  userId: 'user123'
});

// Augment a prompt
const response = await ral.augment('What should I do next?', {
  provider: 'openai'
});

// Use with OpenAI
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: response.systemContext },
    { role: 'user', content: response.userPrompt }
  ]
});
```

## Usage with Different Providers

### OpenAI

```typescript
import { RAL, OpenAIHelper } from 'ral-sdk';

const ral = new RAL({ serverUrl: 'https://ral.example.com' });
const response = await ral.augment('What meetings do I have?', { provider: 'openai' });

const messages = OpenAIHelper.buildMessages(response);
// Use with openai.chat.completions.create()
```

### Anthropic Claude

```typescript
import { RAL, AnthropicHelper } from 'ral-sdk';

const ral = new RAL({ serverUrl: 'https://ral.example.com' });
const response = await ral.augment('Help me plan my day', { provider: 'anthropic' });

const request = AnthropicHelper.buildRequest(response);
// Use with anthropic.messages.create()
```

### Google Gemini

```typescript
import { RAL, GoogleHelper } from 'ral-sdk';

const ral = new RAL({ serverUrl: 'https://ral.example.com' });
const response = await ral.augment("What's the weather like?", { provider: 'google' });

const contents = GoogleHelper.buildContents(response);
// Use with model.generateContent()
```

## Browser Extension Usage

```typescript
// In content script or service worker
const ral = new RAL({ 
  serverUrl: 'https://ral.example.com',
  autoDetect: true  // Auto-detect timezone, locale, device
});

const response = await ral.augment(userInput, { provider: 'openai' });
```

## API Reference

### Constructor

```typescript
new RAL({
  serverUrl: string,      // RAL server URL (required)
  userId?: string,        // User identifier (default: 'default')
  timeout?: number,       // Request timeout in ms (default: 30000)
  autoDetect?: boolean    // Auto-detect context signals (default: true)
})
```

### augment()

```typescript
ral.augment(prompt: string, options?: {
  provider?: Provider,           // AI provider (default: 'generic')
  signals?: ContextSignals,      // Context signals
  includeTemporal?: boolean,     // Include time context (default: true)
  includeSpatial?: boolean,      // Include location context (default: true)
  includePreferences?: boolean   // Include user preferences (default: true)
}): Promise<RALResponse>
```

### RALResponse

```typescript
interface RALResponse {
  systemContext: string;      // System prompt with context
  userPrompt: string;         // Processed user prompt
  augmentedPrompt?: string;   // Combined prompt
  metadata: Record<string, unknown>;
}
```

### Provider Types

```typescript
type Provider = 
  | 'openai' 
  | 'anthropic' 
  | 'google' 
  | 'perplexity' 
  | 'cohere' 
  | 'mistral' 
  | 'llama' 
  | 'generic';
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type { 
  RALConfig, 
  RALResponse, 
  ContextSignals, 
  Provider,
  AugmentOptions 
} from 'ral-sdk';
```

## Error Handling

```typescript
import { RAL, RALError } from 'ral-sdk';

try {
  const response = await ral.augment('Hello');
} catch (error) {
  if (error instanceof RALError) {
    console.error(`RAL Error: ${error.message}`);
    if (error.statusCode) {
      console.error(`Status: ${error.statusCode}`);
    }
  }
}
```

## License

MIT
