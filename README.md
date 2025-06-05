# LLM Cost Utils

A utility package for calculating LLM costs and extracting token usage information from API responses.

## Features

- 🚀 **Enhanced Token Usage Extraction**: Supports multiple LLM provider formats
- 💰 **Accurate Cost Calculation**: Handles cache hits, cache writes, and reasoning tokens
- 🔧 **OpenAI Cache Support**: Properly extracts cached tokens from OpenAI's latest response format
- 📊 **AI SDK Integration**: Seamless integration with Vercel AI SDK
- 🌐 **Multi-Provider Support**: Works with OpenAI, Anthropic, Google AI, Mistral, and more

## Recent Updates

### OpenAI Cached Tokens Fix (Latest)
- ✅ **Fixed**: OpenAI cached tokens extraction from `usage.prompt_tokens_details.cached_tokens`
- ✅ **Enhanced**: Proper calculation of `promptCacheMissTokens` (total - cached)
- ✅ **Backward Compatible**: Still supports older cache formats from other providers

### Token Usage Extraction Improvements
- Better handling of different provider response formats
- More accurate cache hit/miss token calculations
- Enhanced support for reasoning tokens and prediction tokens

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

The library now properly handles OpenAI's cached tokens format and other provider formats:

```typescript
import { extractTokenUsageFromResponseBody, extractTokenUsageFromResponse } from 'llm-cost-utils';

// OpenAI response with cached tokens (NEW FORMAT)
const openaiResponse = {
  model: "gpt-4o",
  usage: {
    prompt_tokens: 2568,
    completion_tokens: 571,
    total_tokens: 3139,
    prompt_tokens_details: {
      cached_tokens: 1280  // ✅ Now properly extracted!
    }
  }
};

const openaiTokenUsage = extractTokenUsageFromResponseBody(openaiResponse);
console.log(openaiTokenUsage);
// {
//   promptCacheMissTokens: 1288,  // 2568 - 1280
//   promptCacheHitTokens: 1280,   // ✅ Correctly extracted
//   reasoningTokens: 0,
//   completionTokens: 571,
//   totalOutputTokens: 571,
//   totalInputTokens: 2568,       // 1288 + 1280
//   promptCacheWriteTokens: 0,
//   model: "gpt-4o"
// }

// Standard response without cached tokens
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
//   promptCacheWriteTokens: 0,
//   model: undefined
// }

// AI SDK format (Vercel AI SDK)
const aiSdkResponse = {
  model: "gpt-4o",
  usage: {
    promptTokens: 91,
    completionTokens: 38,
    totalTokens: 129
  },
  providerMetadata: {
    openai: {
      cachedPromptTokens: 0,
      reasoningTokens: 0,
      acceptedPredictionTokens: 0,
      rejectedPredictionTokens: 0
    }
  }
};

const aiSdkTokenUsage = extractTokenUsageFromResponseBody(aiSdkResponse);
console.log(aiSdkTokenUsage);
// {
//   promptCacheMissTokens: 91,
//   promptCacheHitTokens: 0,
//   reasoningTokens: 0,
//   completionTokens: 38,
//   totalOutputTokens: 38,
//   totalInputTokens: 91,
//   promptCacheWriteTokens: 0,
//   model: "gpt-4o"
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

### Integration with AI SDK (Vercel AI SDK)

When using the Vercel AI SDK, you can easily integrate `llm-cost-utils` using the `onFinish` callback:

```typescript
import { streamObject, generateObject } from 'ai';
import { calculateRequestCost, extractTokenUsageFromResponse } from 'llm-cost-utils';

// Streaming example
async function streamingExample() {
  let finalUsage = null;
  let finalProviderMetadata = null;

  const { partialObjectStream } = await streamObject({
    model: yourModel,
    messages: yourMessages,
    schema: yourSchema,
    onFinish({ usage, providerMetadata }) {
      // Capture usage data from AI SDK
      finalUsage = usage;
      finalProviderMetadata = providerMetadata;
    }
  });

  // Process stream...
  for await (const partialObject of partialObjectStream) {
    // Handle partial results
    console.log(partialObject);
  }

  // Calculate cost using AI SDK format
  if (finalUsage) {
    const aiSdkUsageData = {
      model: "gpt-4o", // Your model name
      usage: finalUsage,
      providerMetadata: finalProviderMetadata
    };

    // Extract usage and calculate cost
    const tokenUsage = extractTokenUsageFromResponse(aiSdkUsageData);
    const cost = calculateRequestCost(
      tokenUsage.model || "gpt-4o",
      tokenUsage.promptCacheMissTokens,
      tokenUsage.totalOutputTokens,
      tokenUsage.promptCacheHitTokens,
      tokenUsage.promptCacheWriteTokens
    );

    console.log('Cost:', cost);
    console.log('Token Usage:', tokenUsage);
  }
}

// Non-streaming example
async function nonStreamingExample() {
  const { object, usage, providerMetadata } = await generateObject({
    model: yourModel,
    messages: yourMessages,
    schema: yourSchema
  });

  // Create AI SDK format for llm-cost-utils
  const aiSdkUsageData = {
    model: "gpt-4o", // Your model name
    usage: usage,
    providerMetadata
  };

  // Extract usage and calculate cost
  const tokenUsage = extractTokenUsageFromResponse(aiSdkUsageData);
  const cost = calculateRequestCost(
    tokenUsage.model || "gpt-4o",
    tokenUsage.promptCacheMissTokens,
    tokenUsage.totalOutputTokens,
    tokenUsage.promptCacheHitTokens,
    tokenUsage.promptCacheWriteTokens
  );

  return {
    result: object,
    cost,
    tokenUsage
  };
}
```

### Why Use onFinish with AI SDK?

The AI SDK's `onFinish` callback provides the cleanest way to capture usage data:

- **Consistent Format**: Always returns `{ promptTokens, completionTokens, totalTokens }`
- **Provider Metadata**: Includes provider-specific details like cached tokens and reasoning tokens
- **Real-time**: Captures data immediately when the request completes
- **Works with Streaming**: Available for both streaming and non-streaming requests

## Supported Models and Providers

The package includes pricing information and token usage extraction for various LLM models:

### ✅ Fully Supported Providers
- **OpenAI**: Including cached tokens from `prompt_tokens_details.cached_tokens`
- **Azure OpenAI**: Full pricing and cache support  
- **Anthropic**: Cache reads, reasoning tokens
- **Google AI**: Cached tokens and reasoning support
- **Mistral**: Standard token usage extraction

### 🔧 Token Usage Formats Supported
- OpenAI format: `usage.prompt_tokens_details.cached_tokens`
- Anthropic format: `usage.cache_read_input_tokens`
- AI SDK format: `providerMetadata.openai.cachedPromptTokens`
- Standard format: Basic `prompt_tokens`, `completion_tokens`

### 💰 Cost Calculation Features
- Cache read costs (discounted rates for cached tokens)
- Cache write costs (one-time caching fees)
- Reasoning token costs (o1 models)
- Standard input/output token costs

## Troubleshooting

### OpenAI Cached Tokens Not Showing?

If you're seeing `promptCacheHitTokens: 0` but know your requests are using cached tokens:

1. **Check OpenAI Response Format**: Look for `usage.prompt_tokens_details.cached_tokens` in your API responses
2. **Update Library**: Make sure you're using the latest version with the cached tokens fix
3. **Verify Response Structure**: Use `extractTokenUsageFromResponse` to see what's being extracted

```typescript
// Debug token extraction
const debugUsage = extractTokenUsageFromResponse(yourResponse);
console.log('Extracted usage:', debugUsage);
console.log('Cache hits:', debugUsage.promptCacheHitTokens);
```

### Cost Calculations Seem Wrong?

- **Cache costs**: Cached tokens typically cost 50% less than regular prompt tokens
- **Model names**: Ensure you're using the exact model name for accurate pricing
- **Token types**: Different token types (input/output/cache/reasoning) have different costs

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
