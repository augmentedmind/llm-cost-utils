// token-cost-calculations.ts
// Calculates token costs for LLM requests based on model and token usage

// Import the model prices data
import { modelPricesData as rawModelPricesData } from "./data/model-prices.js";

// Define the type for the model pricing map
type ModelPricingRawMap = Record<string, ModelPricingRaw>;

/**
 * Interface for model pricing information from the JSON file
 */
export interface ModelPricingRaw {
  max_tokens?: string | number;
  max_input_tokens?: string | number;
  max_output_tokens?: string | number;
  input_cost_per_token: number;
  output_cost_per_token: number;
  input_cost_per_token_batches?: number;
  output_cost_per_token_batches?: number;
  cache_read_input_token_cost?: number;
  cache_creation_input_token_cost?: number;
  input_cost_per_audio_token?: number;
  output_cost_per_audio_token?: number;

  // Existing tiered pricing attributes
  input_cost_per_token_above_200k_tokens?: number;
  output_cost_per_token_above_200k_tokens?: number;
  input_cost_per_token_above_128k_tokens?: number;
  output_cost_per_token_above_128k_tokens?: number;

  litellm_provider?: string;
  mode?: string;
  supports_function_calling?: boolean;
  supports_parallel_function_calling?: boolean;
  supports_vision?: boolean;
  supports_audio_input?: boolean;
  supports_audio_output?: boolean;
  supports_prompt_caching?: boolean;
  supports_response_schema?: boolean;
  supports_system_messages?: boolean;
  deprecation_date?: string;
  [key: string]: any; // Allow for additional properties
}

/**
 * Interface for normalized model pricing information
 */
export interface ModelPricing {
  input_cost_per_token: number;
  output_cost_per_token: number;
  cache_read_input_token_cost?: number;
  cache_creation_input_token_cost?: number;

  // Existing tiered pricing attributes
  input_cost_per_token_above_200k_tokens?: number;
  output_cost_per_token_above_200k_tokens?: number;
  input_cost_per_token_above_128k_tokens?: number;
  output_cost_per_token_above_128k_tokens?: number;
}

// Cast the imported data to the correct type
const modelPricesData: Record<string, ModelPricingRaw> =
  rawModelPricesData as unknown as Record<string, ModelPricingRaw>;

/**
 * Interface for token usage information with standardized field names
 */
export interface TokenUsage {
  // New tokens in the prompt (not from cache)
  promptCacheMissTokens: number;
  // Tokens read from cache
  promptCacheHitTokens: number;
  // Output tokens generated by the model for reasoning
  reasoningTokens: number;
  // Output tokens generated by the model for completion
  completionTokens: number;
  // Total output tokens (reasoning + completion)
  totalOutputTokens: number;
  // Total input tokens (cache miss + cache hit)
  totalInputTokens: number;
  // Tokens written to cache for future use
  promptCacheWriteTokens: number;
}

/**
 * Interface for cost breakdown
 */
export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  totalCost: number;
}

/**
 * Interface for savings analysis
 */
export interface SavingsAnalysis {
  inputSavings: number;
  totalSavings: number;
  percentSaved: number;
}

/**
 * Interface for cache statistics
 */
export interface CacheStatistics {
  hitRate: number;
  totalInputTokens: number;
  cachedTokens: number;
  uncachedTokens: number;
}

/**
 * Interface for comprehensive cost analysis result
 */
export interface RequestCostAnalysis {
  actualCost: CostBreakdown;
  uncachedCost: CostBreakdown;
  savings: SavingsAnalysis;
  cacheStats: CacheStatistics;
}

/**
 * Calculate tiered cost for tokens based on existing tier attributes
 * For output tokens, the tier is typically determined by the input context size
 * @param tokens Number of tokens to calculate cost for
 * @param baseCost Base cost per token
 * @param above200kCost Cost per token above 200k threshold (optional)
 * @param above128kCost Cost per token above 128k threshold (optional)
 * @param contextTokens Total input context tokens (for output pricing tier determination)
 * @returns Total cost for the tokens
 */
function calculateTieredTokenCost(
  tokens: number,
  baseCost: number,
  above200kCost?: number,
  above128kCost?: number,
  contextTokens?: number,
): number {
  // If no tier pricing is defined, use flat rate
  if (above200kCost === undefined && above128kCost === undefined) {
    return tokens * baseCost;
  }

  // Use contextTokens for tier determination if provided, otherwise use tokens
  const tierDeterminantTokens =
    contextTokens !== undefined ? contextTokens : tokens;

  // Handle 200k tier (most common for Gemini models)
  if (above200kCost !== undefined) {
    if (tierDeterminantTokens <= 200000) {
      return tokens * baseCost;
    } else {
      return tokens * above200kCost;
    }
  }

  // Handle 128k tier (common for Claude and other models)
  if (above128kCost !== undefined) {
    if (tierDeterminantTokens <= 128000) {
      return tokens * baseCost;
    } else {
      return tokens * above128kCost;
    }
  }

  // Fallback to base cost
  return tokens * baseCost;
}

/**
 * Map a model name to its default provider if no provider is specified
 */
function mapToDefaultProvider(model: string): string {
  const normalizedModel = model.toLowerCase().trim();

  // If model already has a provider prefix, return as-is
  if (normalizedModel.includes("/")) {
    return model;
  }

  // Map models to their default providers based on naming patterns
  if (normalizedModel.startsWith("mistral-")) {
    return `mistral/${model}`;
  }

  if (normalizedModel.startsWith("claude-")) {
    return model; // Claude models in the data are typically without provider prefix
  }

  if (
    normalizedModel.startsWith("gpt-") ||
    normalizedModel.startsWith("o1-") ||
    normalizedModel.startsWith("text-")
  ) {
    return model; // OpenAI models are typically without provider prefix
  }

  if (normalizedModel.startsWith("gemini-")) {
    return model; // Google models are typically without provider prefix
  }

  // For other models, return as-is and let the existing matching logic handle it
  return model;
}

/**
 * Get the model pricing information for a specific model
 * @throws Error if model pricing is not found
 */
export function getModelPricing(model: string): ModelPricing {
  // First, try to map to default provider if needed
  const mappedModel = mapToDefaultProvider(model);
  const normalizedModel = mappedModel.toLowerCase().trim();

  let rawPricing: ModelPricingRaw | undefined;

  // Try to find an exact match
  if (normalizedModel in modelPricesData) {
    rawPricing = modelPricesData[normalizedModel];
  } else {
    // If mapped model wasn't found, try original model name for backwards compatibility
    const originalNormalized = model.toLowerCase().trim();
    if (originalNormalized in modelPricesData) {
      rawPricing = modelPricesData[originalNormalized];
    } else {
      // Try to find a match by comparing the model name without provider prefix
      for (const knownModel of Object.keys(modelPricesData)) {
        const knownModelWithoutProvider = knownModel
          .split("/")
          .pop()
          ?.toLowerCase();
        if (knownModelWithoutProvider === originalNormalized) {
          rawPricing = modelPricesData[knownModel];
          break;
        }
      }
    }
  }

  if (!rawPricing) {
    throw new Error(
      `Model pricing not found for "${model}". Please update the model prices data.`,
    );
  }

  // Return pricing with tier attributes included
  return {
    input_cost_per_token: rawPricing.input_cost_per_token,
    output_cost_per_token: rawPricing.output_cost_per_token,
    cache_read_input_token_cost: rawPricing.cache_read_input_token_cost,
    cache_creation_input_token_cost: rawPricing.cache_creation_input_token_cost,
    input_cost_per_token_above_200k_tokens:
      rawPricing.input_cost_per_token_above_200k_tokens,
    output_cost_per_token_above_200k_tokens:
      rawPricing.output_cost_per_token_above_200k_tokens,
    input_cost_per_token_above_128k_tokens:
      rawPricing.input_cost_per_token_above_128k_tokens,
    output_cost_per_token_above_128k_tokens:
      rawPricing.output_cost_per_token_above_128k_tokens,
  };
}

/**
 * Calculate comprehensive cost analysis for a request based on token usage
 * @param model The model name used for the request
 * @param promptCacheMissTokens Number of tokens not served from cache
 * @param totalOutputTokens Total output tokens generated
 * @param promptCacheHitTokens Number of tokens served from cache (default: 0)
 * @param promptCacheWriteTokens Number of tokens written to cache (default: 0)
 * @returns Comprehensive cost analysis including actual cost, uncached cost, savings, and cache stats
 */
export function calculateRequestCost(
  model: string,
  promptCacheMissTokens: number,
  totalOutputTokens: number,
  promptCacheHitTokens: number = 0,
  promptCacheWriteTokens: number = 0,
): RequestCostAnalysis {
  // Get model pricing
  const pricing = getModelPricing(model);

  // Calculate total input tokens for tier determination
  const totalInputTokens = promptCacheMissTokens + promptCacheHitTokens;

  // Calculate actual costs using tiered pricing (with caching applied)
  const actualInputCost = calculateTieredTokenCost(
    promptCacheMissTokens,
    pricing.input_cost_per_token,
    pricing.input_cost_per_token_above_200k_tokens,
    pricing.input_cost_per_token_above_128k_tokens,
  );

  // For output cost, tier is determined by total input context size
  const actualOutputCost = calculateTieredTokenCost(
    totalOutputTokens,
    pricing.output_cost_per_token,
    pricing.output_cost_per_token_above_200k_tokens,
    pricing.output_cost_per_token_above_128k_tokens,
    totalInputTokens, // Pass input context for tier determination
  );
  const cacheReadRate = pricing.cache_read_input_token_cost || 0;
  const cacheReadCost = promptCacheHitTokens * cacheReadRate;
  const cacheWriteRate = pricing.cache_creation_input_token_cost || 0;
  const cacheWriteCost = promptCacheWriteTokens * cacheWriteRate;
  const actualTotalCost =
    actualInputCost + actualOutputCost + cacheReadCost + cacheWriteCost;

  // Calculate uncached costs using tiered pricing (as if no caching was used)
  // Important: if no caching was used, cache write tokens would be regular input tokens
  const totalInputTokensIfUncached = totalInputTokens + promptCacheWriteTokens;
  const uncachedInputCost = calculateTieredTokenCost(
    totalInputTokensIfUncached,
    pricing.input_cost_per_token,
    pricing.input_cost_per_token_above_200k_tokens,
    pricing.input_cost_per_token_above_128k_tokens,
  );

  const uncachedOutputCost = calculateTieredTokenCost(
    totalOutputTokens,
    pricing.output_cost_per_token,
    pricing.output_cost_per_token_above_200k_tokens,
    pricing.output_cost_per_token_above_128k_tokens,
    totalInputTokensIfUncached, // Pass the uncached input context for tier determination
  );
  const uncachedTotalCost = uncachedInputCost + uncachedOutputCost;

  // Calculate savings
  const inputSavings = uncachedInputCost - actualInputCost;
  const totalSavings = uncachedTotalCost - actualTotalCost;
  const percentSaved =
    uncachedTotalCost > 0 ? (totalSavings / uncachedTotalCost) * 100 : 0;

  // Calculate cache statistics
  const hitRate =
    totalInputTokensIfUncached > 0
      ? promptCacheHitTokens / totalInputTokensIfUncached
      : 0;

  return {
    actualCost: {
      inputCost: actualInputCost,
      outputCost: actualOutputCost,
      cacheReadCost,
      cacheWriteCost,
      totalCost: actualTotalCost,
    },
    uncachedCost: {
      inputCost: uncachedInputCost,
      outputCost: uncachedOutputCost,
      cacheReadCost: 0,
      cacheWriteCost: 0,
      totalCost: uncachedTotalCost,
    },
    savings: {
      inputSavings,
      totalSavings,
      percentSaved,
    },
    cacheStats: {
      hitRate,
      totalInputTokens: totalInputTokensIfUncached,
      cachedTokens: promptCacheHitTokens,
      uncachedTokens: promptCacheMissTokens + promptCacheWriteTokens,
    },
  };
}
