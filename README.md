# LLM Cost Utils

A utility package for calculating LLM costs and extracting token usage information from API responses.

## Installation

```bash
# Install from GitHub
npm install github:augmentedmind/llm-cost-utils

# Or clone and install locally
git clone git@github.com:augmentedmind/llm-cost-utils.git
cd llm-cost-utils
npm install
```

## Usage

### Token Usage Extraction

```typescript
import { extractTokenUsageFromResponseBody, extractTokenUsageFromResponse } from 'llm-cost-utils';

// Extract token usage from a response body object
const responseBody = {
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150
  }
};

const tokenUsage = extractTokenUsageFromResponseBody(responseBody);
console.log(tokenUsage);
// {
//   promptCacheMissTokens: 100,
//   promptCacheHitTokens: 0,
//   reasoningTokens: 0,
//   completionTokens: 50,
//   totalOutputTokens: 50,
//   totalInputTokens: 100,
//   promptCacheWriteTokens: 0
// }

// Extract token usage from a raw response body (string or object)
// This can handle both JSON responses and streaming SSE responses
// It also extracts the model information when available
const jsonResponse = '{"model":"gpt-4o","usage":{"prompt_tokens":100,"completion_tokens":50,"total_tokens":150}}';
const sseResponse = 'data: {"model":"claude-3-haiku-20240307","usage":{"prompt_tokens":100,"completion_tokens":50}}\n\n';

const jsonTokenUsage = extractTokenUsageFromResponse(jsonResponse);
console.log(jsonTokenUsage);
// {
//   promptCacheMissTokens: 100,
//   promptCacheHitTokens: 0,
//   reasoningTokens: 0,
//   completionTokens: 50,
//   totalOutputTokens: 50,
//   totalInputTokens: 100,
//   promptCacheWriteTokens: 0,
//   model: "gpt-4o"
// }

const sseTokenUsage = extractTokenUsageFromResponse(sseResponse);
```

### Cost Calculation

```typescript
import { calculateRequestCost } from 'llm-cost-utils';

// Calculate cost for a request
const cost = calculateRequestCost(
  'gpt-4o',                    // model name
  100,                        // promptCacheMissTokens
  50,                         // totalOutputTokens
  0,                          // promptCacheHitTokens (optional)
  0                           // promptCacheWriteTokens (optional)
);

console.log(cost);
// {
//   inputCost: 0.03,          // $0.03 for input tokens
//   outputCost: 0.06,         // $0.06 for output tokens
//   cacheReadCost: 0,         // $0 for cache reads
//   cacheWriteCost: 0,        // $0 for cache writes
//   totalCost: 0.09           // Total cost: $0.09
// }
```

### Full Example with Response Storage and Model Auto-Detection

```typescript
import { calculateRequestCost, extractTokenUsageFromResponse } from 'llm-cost-utils';

async function processResponse(responseBody: string | object) {
  // Extract token usage from raw response (includes model when available)
  const tokenUsage = extractTokenUsageFromResponse(responseBody);

  // Use extracted model if available, or fallback to default
  const model = tokenUsage.model || 'gpt-4o';

  // Calculate cost using the extracted model
  const cost = calculateRequestCost(
    model,
    tokenUsage.promptCacheMissTokens,
    tokenUsage.totalOutputTokens,
    tokenUsage.promptCacheHitTokens,
    tokenUsage.promptCacheWriteTokens
  );

  // Store response with metadata
  const responseWithMetadata = {
    responseBody,
    timestamp: new Date().toISOString(),
    metadata: {
      model,
      cost,
      tokenUsage
    }
  };

  // Save to file or database
  await saveToStorage(responseWithMetadata);
}
```

## Supported Models

The package includes pricing information for various LLM models including:
- OpenAI models
- Azure OpenAI models
- Anthropic models
- Google AI models
- Mistral models

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Watch mode for development
npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT
