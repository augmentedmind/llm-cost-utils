// token-cost-calculations.ts
// Calculates token costs for LLM requests based on model and token usage
// Import the model prices data
import { modelPricesData as rawModelPricesData } from './data/model-prices';
// Cast the imported data to the correct type
const modelPricesData = rawModelPricesData;
/**
 * Get the model pricing information for a specific model
 * @throws Error if model pricing is not found
 */
export function getModelPricing(model) {
    // Normalize model name (remove any version suffixes, etc.)
    const normalizedModel = model.toLowerCase().trim();
    // Try to find an exact match
    if (normalizedModel in modelPricesData) {
        return modelPricesData[normalizedModel];
    }
    // Try to find a match by comparing the model name without provider prefix
    for (const knownModel of Object.keys(modelPricesData)) {
        const knownModelWithoutProvider = knownModel.split('/').pop()?.toLowerCase();
        if (knownModelWithoutProvider === normalizedModel) {
            return modelPricesData[knownModel];
        }
    }
    // Throw an error if model pricing is not found
    throw new Error(`Model pricing not found for "${model}". Please update the model prices data.`);
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
export function calculateRequestCost(model, promptCacheMissTokens, totalOutputTokens, promptCacheHitTokens = 0, promptCacheWriteTokens = 0) {
    // Get model pricing
    const pricing = getModelPricing(model);
    // Calculate actual costs (with caching applied)
    const actualInputCost = promptCacheMissTokens * pricing.input_cost_per_token;
    const actualOutputCost = totalOutputTokens * pricing.output_cost_per_token;
    const cacheReadRate = pricing.cache_read_input_token_cost || 0;
    const cacheReadCost = promptCacheHitTokens * cacheReadRate;
    const cacheWriteRate = pricing.cache_creation_input_token_cost || 0;
    const cacheWriteCost = promptCacheWriteTokens * cacheWriteRate;
    const actualTotalCost = actualInputCost + actualOutputCost + cacheReadCost + cacheWriteCost;
    // Calculate uncached costs (as if no caching was used)
    const totalInputTokens = promptCacheMissTokens + promptCacheHitTokens;
    const uncachedInputCost = totalInputTokens * pricing.input_cost_per_token;
    const uncachedOutputCost = totalOutputTokens * pricing.output_cost_per_token;
    const uncachedTotalCost = uncachedInputCost + uncachedOutputCost;
    // Calculate savings
    const inputSavings = uncachedInputCost - actualInputCost;
    const totalSavings = uncachedTotalCost - actualTotalCost;
    const percentSaved = uncachedTotalCost > 0 ? (totalSavings / uncachedTotalCost) * 100 : 0;
    // Calculate cache statistics
    const hitRate = totalInputTokens > 0 ? promptCacheHitTokens / totalInputTokens : 0;
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
            totalInputTokens,
            cachedTokens: promptCacheHitTokens,
            uncachedTokens: promptCacheMissTokens,
        },
    };
}
