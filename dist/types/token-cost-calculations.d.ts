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
    [key: string]: any;
}
/**
 * Interface for normalized model pricing information
 */
export interface ModelPricing {
    input_cost_per_token: number;
    output_cost_per_token: number;
    cache_read_input_token_cost?: number;
    cache_creation_input_token_cost?: number;
    input_cost_per_token_above_200k_tokens?: number;
    output_cost_per_token_above_200k_tokens?: number;
    input_cost_per_token_above_128k_tokens?: number;
    output_cost_per_token_above_128k_tokens?: number;
}
/**
 * Interface for token usage information with standardized field names
 */
export interface TokenUsage {
    promptCacheMissTokens: number;
    promptCacheHitTokens: number;
    reasoningTokens: number;
    completionTokens: number;
    totalOutputTokens: number;
    totalInputTokens: number;
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
 * Get the model pricing information for a specific model
 * @throws Error if model pricing is not found
 */
export declare function getModelPricing(model: string): ModelPricing;
/**
 * Calculate comprehensive cost analysis for a request based on token usage
 * @param model The model name used for the request
 * @param promptCacheMissTokens Number of tokens not served from cache
 * @param totalOutputTokens Total output tokens generated
 * @param promptCacheHitTokens Number of tokens served from cache (default: 0)
 * @param promptCacheWriteTokens Number of tokens written to cache (default: 0)
 * @returns Comprehensive cost analysis including actual cost, uncached cost, savings, and cache stats
 */
export declare function calculateRequestCost(model: string, promptCacheMissTokens: number, totalOutputTokens: number, promptCacheHitTokens?: number, promptCacheWriteTokens?: number): RequestCostAnalysis;
