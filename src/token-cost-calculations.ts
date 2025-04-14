// token-cost-calculations.ts
// Calculates token costs for LLM requests based on model and token usage

// Import the model prices data
// This will need to be copied from the API package data directory
import rawModelPricesData from './data/model-prices.json'

// Define the type for the model pricing map
type ModelPricingRawMap = Record<string, ModelPricingRaw>

/**
 * Interface for model pricing information from the JSON file
 */
export interface ModelPricingRaw {
  max_tokens?: string | number
  max_input_tokens?: string | number
  max_output_tokens?: string | number
  input_cost_per_token: number
  output_cost_per_token: number
  input_cost_per_token_batches?: number
  output_cost_per_token_batches?: number
  cache_read_input_token_cost?: number
  cache_creation_input_token_cost?: number
  input_cost_per_audio_token?: number
  output_cost_per_audio_token?: number
  litellm_provider?: string
  mode?: string
  supports_function_calling?: boolean
  supports_parallel_function_calling?: boolean
  supports_vision?: boolean
  supports_audio_input?: boolean
  supports_audio_output?: boolean
  supports_prompt_caching?: boolean
  supports_response_schema?: boolean
  supports_system_messages?: boolean
  deprecation_date?: string
  [key: string]: any // Allow for additional properties
}

/**
 * Interface for normalized model pricing information
 */
export interface ModelPricing {
  input_cost_per_token: number
  output_cost_per_token: number
  cache_read_input_token_cost?: number
  cache_creation_input_token_cost?: number
}

// Cast the imported data to the correct type
const modelPricesData: Record<string, ModelPricingRaw> = rawModelPricesData as unknown as Record<string, ModelPricingRaw>

/**
 * Interface for token usage information with standardized field names
 */
export interface TokenUsage {
  // New tokens in the prompt (not from cache)
  promptCacheMissTokens: number
  // Tokens read from cache
  promptCacheHitTokens: number
  // Output tokens generated by the model for reasoning
  reasoningTokens: number
  // Output tokens generated by the model for completion
  completionTokens: number
  // Total output tokens (reasoning + completion)
  totalOutputTokens: number
  // Total input tokens (cache miss + cache hit)
  totalInputTokens: number
  // Tokens written to cache for future use
  promptCacheWriteTokens: number
}

/**
 * Interface for cost calculation result
 */
export interface RequestCost {
  inputCost: number
  outputCost: number
  cacheReadCost: number
  cacheWriteCost: number
  totalCost: number
}

/**
 * Get the model pricing information for a specific model
 * @throws Error if model pricing is not found
 */
export function getModelPricing(model: string): ModelPricing {
  // Normalize model name (remove any version suffixes, etc.)
  const normalizedModel = model.toLowerCase().trim()

  // Try to find an exact match
  if (normalizedModel in modelPricesData) {
    return modelPricesData[normalizedModel] as ModelPricing
  }

  // Try to find a partial match (e.g., if model includes version info)
  for (const knownModel of Object.keys(modelPricesData)) {
    if (normalizedModel.includes(knownModel)) {
      return modelPricesData[knownModel] as ModelPricing
    }
  }

  // Throw an error if model pricing is not found
  throw new Error(`Model pricing not found for "${model}". Please update the model prices data.`)
}

/**
 * Calculate the cost for a request based on token usage
 */
export function calculateRequestCost(
  model: string,
  promptCacheMissTokens: number,
  totalOutputTokens: number,
  promptCacheHitTokens: number = 0,
  promptCacheWriteTokens: number = 0,
): RequestCost {
  // Get model pricing
  const pricing = getModelPricing(model)

  const inputCost = promptCacheMissTokens * pricing.input_cost_per_token
  const outputCost = totalOutputTokens * pricing.output_cost_per_token

  // Use cache read cost if available
  const cacheReadRate = pricing.cache_read_input_token_cost || 0
  const cacheReadCost = promptCacheHitTokens * cacheReadRate

  // Use cache write cost if available
  const cacheWriteRate = pricing.cache_creation_input_token_cost || 0
  const cacheWriteCost = promptCacheWriteTokens * cacheWriteRate

  const totalCost = inputCost + outputCost + cacheReadCost + cacheWriteCost

  return {
    inputCost,
    outputCost,
    cacheReadCost,
    cacheWriteCost,
    totalCost,
  }
}
