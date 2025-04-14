# LLM Cost Utils

A utility package for calculating and tracking LLM (Large Language Model) token usage and associated costs.

## Features

- Calculate costs for various LLM models based on token usage
- Extract token usage information from API responses
- Support for various LLM providers (OpenAI, Anthropic, etc.)

## Installation

```bash
# Using npm
npm install @augmentedmind/llm-cost-utils

# Using yarn
yarn add @augmentedmind/llm-cost-utils

# Using pnpm
pnpm add @augmentedmind/llm-cost-utils
```

You can also install directly from GitHub:

```bash
npm install github:augmentedmind/llm-cost-utils
```

## Usage

```typescript
import { calculateCost, extractTokenUsage } from '@augmentedmind/llm-cost-utils';

// Example: Calculate cost for OpenAI usage
const cost = calculateCost({
  model: 'gpt-4',
  promptTokens: 100,
  completionTokens: 50
});

console.log(`Cost: $${cost}`);

// Extract token usage from an API response
const response = {
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150
  }
};

const usage = extractTokenUsage(response);
console.log(usage);
```

## License

MIT
