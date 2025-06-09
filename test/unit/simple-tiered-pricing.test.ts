import { describe, test, expect } from 'vitest'
import { calculateRequestCost, getModelPricing } from '../../src/token-cost-calculations.js'

describe('Simple Tiered Pricing Support', () => {
  test('should handle Gemini 2.5 Pro 200k tier pricing', () => {
    // Test with tokens above 200k threshold
    const aboveThreshold = calculateRequestCost(
      'gemini-2.5-pro-preview-05-06',
      250000, // Above 200k threshold
      5000,   // Output tokens
      0,      // Cache hits
      0       // Cache writes
    )

    // Test with tokens below 200k threshold
    const belowThreshold = calculateRequestCost(
      'gemini-2.5-pro-preview-05-06',
      150000, // Below 200k threshold
      5000,   // Output tokens
      0,      // Cache hits
      0       // Cache writes
    )

    // Above threshold should cost more per input token
    expect(aboveThreshold.actualCost.inputCost).toBeGreaterThan(belowThreshold.actualCost.inputCost)
    
    // Output pricing depends on same token count, but tier should affect it based on implementation
    // For now, let's verify the input calculation which is the main tiered pricing feature
    
    // Verify exact calculations
    const expectedBelowInput = 150000 * 0.00000125  // Lower tier rate
    const expectedAboveInput = 250000 * 0.0000025   // Higher tier rate
    const expectedOutputBelow = 5000 * 0.00001      // Lower tier rate
    const expectedOutputAbove = 5000 * 0.000015     // Higher tier rate
    
    expect(belowThreshold.actualCost.inputCost).toBeCloseTo(expectedBelowInput, 6)
    expect(aboveThreshold.actualCost.inputCost).toBeCloseTo(expectedAboveInput, 6)
    expect(belowThreshold.actualCost.outputCost).toBeCloseTo(expectedOutputBelow, 6)
    expect(aboveThreshold.actualCost.outputCost).toBeCloseTo(expectedOutputAbove, 6)
  })

  test('should handle models without tiered pricing (flat rate)', () => {
    const analysis = calculateRequestCost(
      'gpt-4o',
      100000, // Input tokens
      5000,   // Output tokens
      0,      // Cache hits
      0       // Cache writes
    )

    // Should calculate normally for non-tiered models
    expect(analysis.actualCost.inputCost).toBeGreaterThan(0)
    expect(analysis.actualCost.outputCost).toBeGreaterThan(0)
    expect(analysis.actualCost.totalCost).toBeGreaterThan(0)
  })

  test('should calculate cache savings correctly with tiered pricing', () => {
    const analysis = calculateRequestCost(
      'gemini-2.5-pro-preview-05-06',
      100000, // Cache miss tokens (below threshold)
      2000,   // Output tokens
      150000, // Cache hit tokens (would put total at 250k, above threshold)
      0       // Cache writes
    )

    // Verify that uncached cost considers all input tokens at the higher tier
    // while actual cost only pays for cache misses at lower tier
    expect(analysis.uncachedCost.inputCost).toBeGreaterThan(analysis.actualCost.inputCost)
    expect(analysis.savings.totalSavings).toBeGreaterThan(0)
    expect(analysis.cacheStats.hitRate).toBeCloseTo(0.6, 1) // 150k/250k
  })

  test('should extract tier attributes from model pricing', () => {
    const pricing = getModelPricing('gemini-2.5-pro-preview-05-06')
    
    // Should have tier attributes for 200k threshold
    expect(pricing.input_cost_per_token_above_200k_tokens).toBeDefined()
    expect(pricing.output_cost_per_token_above_200k_tokens).toBeDefined()
    
    // Verify tier pricing is higher than base pricing
    expect(pricing.input_cost_per_token_above_200k_tokens).toBeGreaterThan(pricing.input_cost_per_token)
    expect(pricing.output_cost_per_token_above_200k_tokens).toBeGreaterThan(pricing.output_cost_per_token)
  })

  test('should handle exact threshold boundary correctly', () => {
    const exactThreshold = calculateRequestCost(
      'gemini-2.5-pro-preview-05-06',
      200000, // Exactly at 200k threshold
      1000,   // Output tokens
      0,      // Cache hits
      0       // Cache writes
    )

    // Should use lower tier pricing for tokens <= threshold
    const expectedCost = 200000 * 0.00000125
    expect(exactThreshold.actualCost.inputCost).toBeCloseTo(expectedCost, 6)
  })
}) 