// token-cost-calculations.ts
// Calculates token costs for LLM requests based on model and token usage
// Import the model prices data
import { modelPricesData as rawModelPricesData } from './data/model-prices.js';
// Cast the imported data to the correct type
const modelPricesData = rawModelPricesData;
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
function calculateTieredTokenCost(tokens, baseCost, above200kCost, above128kCost, contextTokens) {
    // If no tier pricing is defined, use flat rate
    if (above200kCost === undefined && above128kCost === undefined) {
        return tokens * baseCost;
    }
    // Use contextTokens for tier determination if provided, otherwise use tokens
    const tierDeterminantTokens = contextTokens !== undefined ? contextTokens : tokens;
    // Handle 200k tier (most common for Gemini models)
    if (above200kCost !== undefined) {
        if (tierDeterminantTokens <= 200000) {
            return tokens * baseCost;
        }
        else {
            return tokens * above200kCost;
        }
    }
    // Handle 128k tier (common for Claude and other models)
    if (above128kCost !== undefined) {
        if (tierDeterminantTokens <= 128000) {
            return tokens * baseCost;
        }
        else {
            return tokens * above128kCost;
        }
    }
    // Fallback to base cost
    return tokens * baseCost;
}
/**
 * Map a model name to its default provider if no provider is specified
 */
function mapToDefaultProvider(model) {
    const normalizedModel = model.toLowerCase().trim();
    // If model already has a provider prefix, return as-is
    if (normalizedModel.includes('/')) {
        return model;
    }
    // Map models to their default providers based on naming patterns
    if (normalizedModel.startsWith('mistral-')) {
        return `mistral/${model}`;
    }
    if (normalizedModel.startsWith('claude-')) {
        return model; // Claude models in the data are typically without provider prefix
    }
    if (normalizedModel.startsWith('gpt-') || normalizedModel.startsWith('o1-') || normalizedModel.startsWith('text-')) {
        return model; // OpenAI models are typically without provider prefix
    }
    if (normalizedModel.startsWith('gemini-')) {
        return model; // Google models are typically without provider prefix  
    }
    // For other models, return as-is and let the existing matching logic handle it
    return model;
}
/**
 * Get the model pricing information for a specific model
 * @throws Error if model pricing is not found
 */
export function getModelPricing(model) {
    // First, try to map to default provider if needed
    const mappedModel = mapToDefaultProvider(model);
    const normalizedModel = mappedModel.toLowerCase().trim();
    let rawPricing;
    // Try to find an exact match
    if (normalizedModel in modelPricesData) {
        rawPricing = modelPricesData[normalizedModel];
    }
    else {
        // If mapped model wasn't found, try original model name for backwards compatibility
        const originalNormalized = model.toLowerCase().trim();
        if (originalNormalized in modelPricesData) {
            rawPricing = modelPricesData[originalNormalized];
        }
        else {
            // Try to find a match by comparing the model name without provider prefix
            for (const knownModel of Object.keys(modelPricesData)) {
                const knownModelWithoutProvider = knownModel.split('/').pop()?.toLowerCase();
                if (knownModelWithoutProvider === originalNormalized) {
                    rawPricing = modelPricesData[knownModel];
                    break;
                }
            }
        }
    }
    if (!rawPricing) {
        throw new Error(`Model pricing not found for "${model}". Please update the model prices data.`);
    }
    // Return pricing with tier attributes included
    return {
        input_cost_per_token: rawPricing.input_cost_per_token,
        output_cost_per_token: rawPricing.output_cost_per_token,
        cache_read_input_token_cost: rawPricing.cache_read_input_token_cost,
        cache_creation_input_token_cost: rawPricing.cache_creation_input_token_cost,
        input_cost_per_token_above_200k_tokens: rawPricing.input_cost_per_token_above_200k_tokens,
        output_cost_per_token_above_200k_tokens: rawPricing.output_cost_per_token_above_200k_tokens,
        input_cost_per_token_above_128k_tokens: rawPricing.input_cost_per_token_above_128k_tokens,
        output_cost_per_token_above_128k_tokens: rawPricing.output_cost_per_token_above_128k_tokens
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
export function calculateRequestCost(model, promptCacheMissTokens, totalOutputTokens, promptCacheHitTokens = 0, promptCacheWriteTokens = 0) {
    // Get model pricing
    const pricing = getModelPricing(model);
    // Calculate total input tokens for tier determination
    const totalInputTokens = promptCacheMissTokens + promptCacheHitTokens;
    // Calculate actual costs using tiered pricing (with caching applied)
    const actualInputCost = calculateTieredTokenCost(promptCacheMissTokens, pricing.input_cost_per_token, pricing.input_cost_per_token_above_200k_tokens, pricing.input_cost_per_token_above_128k_tokens);
    // For output cost, tier is determined by total input context size
    const actualOutputCost = calculateTieredTokenCost(totalOutputTokens, pricing.output_cost_per_token, pricing.output_cost_per_token_above_200k_tokens, pricing.output_cost_per_token_above_128k_tokens, totalInputTokens // Pass input context for tier determination
    );
    const cacheReadRate = pricing.cache_read_input_token_cost || 0;
    const cacheReadCost = promptCacheHitTokens * cacheReadRate;
    const cacheWriteRate = pricing.cache_creation_input_token_cost || 0;
    const cacheWriteCost = promptCacheWriteTokens * cacheWriteRate;
    const actualTotalCost = actualInputCost + actualOutputCost + cacheReadCost + cacheWriteCost;
    // Calculate uncached costs using tiered pricing (as if no caching was used)
    // Important: if no caching was used, cache write tokens would be regular input tokens
    const totalInputTokensIfUncached = totalInputTokens + promptCacheWriteTokens;
    const uncachedInputCost = calculateTieredTokenCost(totalInputTokensIfUncached, pricing.input_cost_per_token, pricing.input_cost_per_token_above_200k_tokens, pricing.input_cost_per_token_above_128k_tokens);
    const uncachedOutputCost = calculateTieredTokenCost(totalOutputTokens, pricing.output_cost_per_token, pricing.output_cost_per_token_above_200k_tokens, pricing.output_cost_per_token_above_128k_tokens, totalInputTokensIfUncached // Pass the uncached input context for tier determination
    );
    const uncachedTotalCost = uncachedInputCost + uncachedOutputCost;
    // Calculate savings
    const inputSavings = uncachedInputCost - actualInputCost;
    const totalSavings = uncachedTotalCost - actualTotalCost;
    const percentSaved = uncachedTotalCost > 0 ? (totalSavings / uncachedTotalCost) * 100 : 0;
    // Calculate cache statistics
    const hitRate = totalInputTokensIfUncached > 0 ? promptCacheHitTokens / totalInputTokensIfUncached : 0;
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
