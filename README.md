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
import { extractTokenUsageFromResponseBody } from '@augmentedmind/llm-cost-utils';

// Extract token usage from a response
const response = {
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150
  }
};

const tokenUsage = extractTokenUsageFromResponseBody(response);
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
```

### Cost Calculation

```typescript
import { calculateRequestCost } from '@augmentedmind/llm-cost-utils';

// Calculate cost for a request
const cost = calculateRequestCost(
  'gpt-4',                    // model name
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

### Full Example with Response Storage

```typescript
import { calculateRequestCost, extractTokenUsageFromResponseBody } from '@augmentedmind/llm-cost-utils';

async function saveResponse(response: any) {
  // Extract token usage
  const tokenUsage = extractTokenUsageFromResponseBody(response);
  
  // Calculate cost
  const cost = tokenUsage ? calculateRequestCost(
    response.model || 'unknown',
    tokenUsage.promptCacheMissTokens,
    tokenUsage.totalOutputTokens,
    tokenUsage.promptCacheHitTokens,
    tokenUsage.promptCacheWriteTokens
  ) : null;
  
  // Store response with metadata
  const responseWithMetadata = {
    ...response,
    timestamp: new Date().toISOString(),
    metadata: {
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
- OpenAI models (GPT-3.5, GPT-4, etc.)
- Azure OpenAI models
- Anthropic models
- Google AI models

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
