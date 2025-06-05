# LLM Cost Utils

A utility library for extracting token usage and calculating LLM costs from API responses.

## Features

- 🚀 **Token Usage Extraction**: Extract standardized token usage from various LLM provider response formats
- 💰 **Cost Analysis**: Calculate comprehensive cost breakdowns including cache savings
- 🔧 **OpenAI Cache Support**: Properly handles OpenAI's `prompt_tokens_details.cached_tokens` format
- 📊 **AI SDK Ready**: Seamless integration with Vercel AI SDK responses
- 🌐 **Multi-Provider**: Works with OpenAI, Anthropic, Google AI, Mistral, and more

## Installation

```bash
npm install github:augmentedmind/llm-cost-utils
```

## Quick Start

### Token Usage Extraction

```typescript
import { extractTokenUsageFromResponseBody } from 'llm-cost-utils';

// OpenAI response with cached tokens
const openaiResponse = {
  model: "gpt-4o-2024-11-20",
  usage: {
    prompt_tokens: 2568,
    completion_tokens: 268,
    total_tokens: 2836,
    prompt_tokens_details: {
      cached_tokens: 1280
    }
  }
};

const tokenUsage = extractTokenUsageFromResponseBody(openaiResponse);
console.log(tokenUsage);
// Output:
// {
//   promptCacheMissTokens: 1288,  // 2568 - 1280
//   promptCacheHitTokens: 1280,
//   reasoningTokens: 0,
//   completionTokens: 268,
//   totalOutputTokens: 268,
//   totalInputTokens: 2568,       // 1288 + 1280
//   promptCacheWriteTokens: 0,
//   model: "gpt-4o-2024-11-20"
// }
```

### Cost Calculation

```typescript
import { calculateRequestCost } from 'llm-cost-utils';

// Calculate comprehensive cost analysis
const costAnalysis = calculateRequestCost(
  'gpt-4o',                    // model name
  1288,                        // promptCacheMissTokens
  268,                         // totalOutputTokens
  1280,                        // promptCacheHitTokens
  0                            // promptCacheWriteTokens
);

console.log(costAnalysis);
// Output:
// {
//   actualCost: {
//     inputCost: 0.006440,      // Cost for non-cached input tokens
//     outputCost: 0.010720,     // Cost for output tokens
//     cacheReadCost: 0.003200,  // Cost for cached tokens (50% discount)
//     cacheWriteCost: 0,        // Cost for writing to cache
//     totalCost: 0.020360       // Total actual cost
//   },
//   uncachedCost: {
//     inputCost: 0.012840,      // What input would cost without caching
//     outputCost: 0.010720,     // Output cost (same)
//     cacheReadCost: 0,
//     cacheWriteCost: 0,
//     totalCost: 0.023560       // Total without caching
//   },
//   savings: {
//     inputSavings: 0.006400,   // Amount saved on input
//     totalSavings: 0.003200,   // Total amount saved
//     percentSaved: 13.58       // Percentage saved
//   },
//   cacheStats: {
//     hitRate: 0.498,           // 49.8% cache hit rate
//     totalInputTokens: 2568,   // Total input tokens
//     cachedTokens: 1280,       // Tokens served from cache
//     uncachedTokens: 1288      // Tokens not in cache
//   }
// }
```

## Complete Example

```typescript
import { extractTokenUsageFromResponseBody, calculateRequestCost } from 'llm-cost-utils';

async function analyzeResponse(responseBody: any) {
  // Extract token usage
  const tokenUsage = extractTokenUsageFromResponseBody(responseBody);
  
  // Calculate cost analysis
  const costAnalysis = calculateRequestCost(
    tokenUsage.model || 'gpt-4o',
    tokenUsage.promptCacheMissTokens,
    tokenUsage.totalOutputTokens,
    tokenUsage.promptCacheHitTokens,
    tokenUsage.promptCacheWriteTokens
  );
  
  return {
    tokenUsage,
    costAnalysis,
    summary: {
      model: tokenUsage.model,
      totalCost: costAnalysis.actualCost.totalCost,
      savings: costAnalysis.savings.totalSavings,
      cacheHitRate: costAnalysis.cacheStats.hitRate
    }
  };
}
```

## AI SDK Integration

```typescript
import { streamObject } from 'ai';
import { extractTokenUsageFromResponseBody, calculateRequestCost } from 'llm-cost-utils';

const { partialObjectStream, object, usage, providerMetadata } = await streamObject({
  model: yourModel,
  messages: yourMessages,
  schema: yourSchema
});

// Process the stream...
for await (const partialObject of partialObjectStream) {
  console.log(partialObject);
}

// Extract usage after completion
const aiSdkUsageData = {
  model: "gpt-4o",
  usage,
  providerMetadata
};

const tokenUsage = extractTokenUsageFromResponseBody(aiSdkUsageData);
const costAnalysis = calculateRequestCost(
  tokenUsage.model || "gpt-4o",
  tokenUsage.promptCacheMissTokens,
  tokenUsage.totalOutputTokens,
  tokenUsage.promptCacheHitTokens,
  tokenUsage.promptCacheWriteTokens
);
```

## Supported Providers

| Provider | Token Usage | Cached Tokens | Reasoning Tokens | Cost Calculation |
|----------|-------------|---------------|------------------|------------------|
| OpenAI | ✅ | ✅ | ✅ | ✅ |
| Azure OpenAI | ✅ | ✅ | ✅ | ✅ |
| Anthropic | ✅ | ✅ | ✅ | ✅ |
| Google AI | ✅ | ✅ | ✅ | ✅ |
| Mistral | ✅ | ❌ | ❌ | ✅ |

## Token Usage Output Format

All extraction functions return a standardized `TokenUsage` object:

```typescript
interface TokenUsage {
  promptCacheMissTokens: number    // New input tokens (not from cache)
  promptCacheHitTokens: number     // Input tokens served from cache
  reasoningTokens: number          // Output tokens for reasoning (o1 models)
  completionTokens: number         // Output tokens for completion
  totalOutputTokens: number        // Total output tokens (reasoning + completion)
  totalInputTokens: number         // Total input tokens (cache miss + cache hit)
  promptCacheWriteTokens: number   // Tokens written to cache
  model?: string                   // Model name (when available)
}
```

## Cost Analysis Output Format

The `calculateRequestCost` function returns detailed cost breakdown:

```typescript
interface RequestCostAnalysis {
  actualCost: {
    inputCost: number        // Cost for non-cached input tokens
    outputCost: number       // Cost for output tokens
    cacheReadCost: number    // Cost for reading cached tokens (discounted)
    cacheWriteCost: number   // Cost for writing tokens to cache
    totalCost: number        // Total actual cost
  }
  uncachedCost: {
    inputCost: number        // What input would cost without caching
    outputCost: number       // Output cost (same as actual)
    totalCost: number        // Total cost if no caching was used
  }
  savings: {
    inputSavings: number     // Amount saved on input costs
    totalSavings: number     // Total amount saved by caching
    percentSaved: number     // Percentage of cost saved
  }
  cacheStats: {
    hitRate: number          // Cache hit rate (0-1)
    totalInputTokens: number // Total input tokens processed
    cachedTokens: number     // Tokens served from cache
    uncachedTokens: number   // Tokens not in cache
  }
}
```

## Troubleshooting

### OpenAI Cached Tokens Not Detected?

Make sure your OpenAI responses include the `prompt_tokens_details` field:

```json
{
  "usage": {
    "prompt_tokens": 2568,
    "completion_tokens": 268,
    "prompt_tokens_details": {
      "cached_tokens": 1280
    }
  }
}
```

### Cost Seems Wrong?

- **Cache costs**: Cached tokens typically cost 50% of regular input tokens
- **Model names**: Use exact model names for accurate pricing
- **Token breakdown**: Different token types have different rates

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
