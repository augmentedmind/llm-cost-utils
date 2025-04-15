import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calculateRequestCost, getModelPricing } from '../../src/token-cost-calculations'

// Mock the model prices data
vi.mock('../../src/data/model-prices.json', () => ({
  default: {
    'gpt-4': {
      input_cost_per_token: 0.00003,
      output_cost_per_token: 0.00006,
    },
    'openai/gpt-4-turbo': {
      input_cost_per_token: 0.00001,
      output_cost_per_token: 0.00003,
    },
    'mistral/mistral-small-latest': {
      input_cost_per_token: 0.000001,
      output_cost_per_token: 0.000002,
    },
    'claude-3-opus-20240229': {
      input_cost_per_token: 0.000015,
      output_cost_per_token: 0.000075,
      cache_read_input_token_cost: 0.000003,
      cache_creation_input_token_cost: 0.00001875,
    },
    'gemini-2.0-flash': {
      input_cost_per_token: 0.000001,
      output_cost_per_token: 0.000002,
    },
  },
}))

describe('getModelPricing', () => {
  it('should return pricing for exact model match', () => {
    const pricing = getModelPricing('gpt-4')
    expect(pricing.input_cost_per_token).toBe(0.00003)
    expect(pricing.output_cost_per_token).toBe(0.00006)
  })

  it('should return pricing for provider-prefixed model match', () => {
    const pricing = getModelPricing('mistral-small-latest')
    expect(pricing.input_cost_per_token).toBe(0.000001)
    expect(pricing.output_cost_per_token).toBe(0.000002)
  })

  it('should return pricing for provider-prefixed model with different provider', () => {
    const pricing = getModelPricing('gpt-4-turbo')
    expect(pricing.input_cost_per_token).toBe(0.00001)
    expect(pricing.output_cost_per_token).toBe(0.00003)
  })

  it('should throw an error for unknown model', () => {
    expect(() => getModelPricing('unknown-model')).toThrow('Model pricing not found')
  })

  it('should handle case insensitivity', () => {
    const pricing = getModelPricing('GPT-4')
    expect(pricing.input_cost_per_token).toBe(0.00003)
    expect(pricing.output_cost_per_token).toBe(0.00006)
  })
})

describe('calculateRequestCost', () => {
  it('should calculate cost for input and output tokens', () => {
    const cost = calculateRequestCost('gpt-4', 1000, 500)
    // 1000 * 0.00003 = 0.03 cost for input
    // 500 * 0.00006 = 0.03 cost for output
    expect(cost.inputCost).toBeCloseTo(0.03, 6)
    expect(cost.outputCost).toBeCloseTo(0.03, 6)
    expect(cost.totalCost).toBeCloseTo(0.06, 6)
  })

  it('should calculate cost with cache tokens', () => {
    const cost = calculateRequestCost('claude-3-opus-20240229', 1000, 500, 200, 300)
    // 1000 * 0.000015 = 0.015 cost for input
    // 500 * 0.000075 = 0.0375 cost for output
    // 200 * 0.000003 = 0.0006 cost for cache read
    // 300 * 0.00001875 = 0.005625 cost for cache write
    expect(cost.inputCost).toBeCloseTo(0.015, 6)
    expect(cost.outputCost).toBeCloseTo(0.0375, 6)
    expect(cost.cacheReadCost).toBeCloseTo(0.0006, 6)
    expect(cost.cacheWriteCost).toBeCloseTo(0.005625, 6)
    expect(cost.totalCost).toBeCloseTo(0.058725, 5)
  })

  it('should throw an error for unknown model', () => {
    expect(() => calculateRequestCost('unknown-model', 1000, 500)).toThrow('Model pricing not found')
  })
})
