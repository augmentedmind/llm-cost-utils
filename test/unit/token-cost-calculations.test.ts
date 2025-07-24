import { describe, it, expect } from "vitest";
import {
  calculateRequestCost,
  getModelPricing,
} from "../../src/token-cost-calculations";

describe("getModelPricing", () => {
  it("should return pricing for exact model match", () => {
    const pricing = getModelPricing("gpt-4");
    expect(pricing.input_cost_per_token).toBe(0.00003);
    expect(pricing.output_cost_per_token).toBe(0.00006);
  });

  it("should automatically map models to their default providers", () => {
    const pricing = getModelPricing("mistral-small-latest");
    expect(pricing.input_cost_per_token).toBe(1e-7);
    expect(pricing.output_cost_per_token).toBe(3e-7);
  });

  it("should return pricing for gpt-4-turbo", () => {
    const pricing = getModelPricing("gpt-4-turbo");
    expect(pricing.input_cost_per_token).toBe(0.00001);
    expect(pricing.output_cost_per_token).toBe(0.00003);
  });

  it("should throw an error for unknown model", () => {
    expect(() => getModelPricing("unknown-model")).toThrow(
      "Model pricing not found",
    );
  });

  it("should handle case insensitivity", () => {
    const pricing = getModelPricing("GPT-4");
    expect(pricing.input_cost_per_token).toBe(0.00003);
    expect(pricing.output_cost_per_token).toBe(0.00006);
  });

  it("should map mistral models to mistral provider automatically", () => {
    const pricing = getModelPricing("mistral-small-latest");
    // Should find mistral/mistral-small-latest, not azure_ai/mistral-small
    expect(pricing.input_cost_per_token).toBe(1e-7);
    expect(pricing.output_cost_per_token).toBe(3e-7);
  });
});

describe("calculateRequestCost", () => {
  it("should calculate cost analysis for input and output tokens", () => {
    const analysis = calculateRequestCost("gpt-4", 1000, 500);
    // 1000 * 0.00003 = 0.03 cost for input
    // 500 * 0.00006 = 0.03 cost for output
    expect(analysis.actualCost.inputCost).toBeCloseTo(0.03, 6);
    expect(analysis.actualCost.outputCost).toBeCloseTo(0.03, 6);
    expect(analysis.actualCost.totalCost).toBeCloseTo(0.06, 6);

    // No caching, so uncached cost should be the same
    expect(analysis.uncachedCost.totalCost).toBeCloseTo(0.06, 6);
    expect(analysis.savings.totalSavings).toBeCloseTo(0, 6);
    expect(analysis.savings.percentSaved).toBeCloseTo(0, 6);

    // Cache stats for no caching
    expect(analysis.cacheStats.hitRate).toBe(0);
    expect(analysis.cacheStats.totalInputTokens).toBe(1000);
    expect(analysis.cacheStats.cachedTokens).toBe(0);
    expect(analysis.cacheStats.uncachedTokens).toBe(1000);
  });

  it("should calculate comprehensive cost analysis with cache tokens", () => {
    const analysis = calculateRequestCost(
      "claude-3-opus-20240229",
      1000,
      500,
      200,
      300,
    );
    // Using real pricing from model-prices.ts:
    // input_cost_per_token: 0.000015
    // output_cost_per_token: 0.000075
    // cache_read_input_token_cost: 0.0000015
    // cache_creation_input_token_cost: 0.00001875

    // 1000 * 0.000015 = 0.015 cost for input (cache miss)
    // 500 * 0.000075 = 0.0375 cost for output
    // 200 * 0.0000015 = 0.0003 cost for cache read
    // 300 * 0.00001875 = 0.005625 cost for cache write

    // Actual costs (with caching applied)
    expect(analysis.actualCost.inputCost).toBeCloseTo(0.015, 6);
    expect(analysis.actualCost.outputCost).toBeCloseTo(0.0375, 6);
    expect(analysis.actualCost.cacheReadCost).toBeCloseTo(0.0003, 6);
    expect(analysis.actualCost.cacheWriteCost).toBeCloseTo(0.005625, 6);
    expect(analysis.actualCost.totalCost).toBeCloseTo(0.058425, 5);

    // Uncached costs (as if no caching was used)
    // Total input tokens: 1000 + 200 + 300 = 1500 (cache write tokens would be regular input tokens)
    // 1500 * 0.000015 = 0.0225 cost for all input tokens
    expect(analysis.uncachedCost.inputCost).toBeCloseTo(0.0225, 6);
    expect(analysis.uncachedCost.outputCost).toBeCloseTo(0.0375, 6);
    expect(analysis.uncachedCost.cacheReadCost).toBe(0);
    expect(analysis.uncachedCost.cacheWriteCost).toBe(0);
    expect(analysis.uncachedCost.totalCost).toBeCloseTo(0.06, 6);

    // Savings analysis
    const expectedInputSavings = 0.0225 - 0.015; // uncached input - actual input
    expect(analysis.savings.inputSavings).toBeCloseTo(expectedInputSavings, 6);
    const expectedTotalSavings = 0.06 - 0.058425; // uncached total - actual total
    expect(analysis.savings.totalSavings).toBeCloseTo(expectedTotalSavings, 5);
    const expectedPercentSaved = (expectedTotalSavings / 0.06) * 100;
    expect(analysis.savings.percentSaved).toBeCloseTo(expectedPercentSaved, 3);

    // Cache statistics
    expect(analysis.cacheStats.hitRate).toBeCloseTo(200 / 1500, 6); // 200 cached out of 1500 total
    expect(analysis.cacheStats.totalInputTokens).toBe(1500);
    expect(analysis.cacheStats.cachedTokens).toBe(200);
    expect(analysis.cacheStats.uncachedTokens).toBe(1300); // 1000 cache miss + 300 cache write
  });

  it("should handle 100% cache hit scenario", () => {
    const analysis = calculateRequestCost(
      "claude-3-opus-20240229",
      0,
      500,
      1000,
      0,
    );

    // All tokens served from cache (using real pricing: cache_read_input_token_cost: 0.0000015)
    expect(analysis.actualCost.inputCost).toBe(0);
    expect(analysis.actualCost.cacheReadCost).toBeCloseTo(0.0015, 6); // 1000 * 0.0000015
    expect(analysis.actualCost.totalCost).toBeCloseTo(0.039, 6); // output + cache read

    // Uncached would have cost more
    expect(analysis.uncachedCost.inputCost).toBeCloseTo(0.015, 6); // 1000 * 0.000015
    expect(analysis.uncachedCost.totalCost).toBeCloseTo(0.0525, 6); // input + output

    // Should show significant savings
    expect(analysis.savings.totalSavings).toBeCloseTo(0.0135, 6);
    expect(analysis.savings.percentSaved).toBeCloseTo(25.714, 3); // roughly 25.71%

    // Perfect cache hit rate
    expect(analysis.cacheStats.hitRate).toBe(1.0);
    expect(analysis.cacheStats.cachedTokens).toBe(1000);
    expect(analysis.cacheStats.uncachedTokens).toBe(0);
  });

  it("should throw an error for unknown model", () => {
    expect(() => calculateRequestCost("unknown-model", 1000, 500)).toThrow(
      "Model pricing not found",
    );
  });
});
