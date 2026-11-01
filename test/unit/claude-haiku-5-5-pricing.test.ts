import { describe, it, expect } from "vitest";
import {
  calculateRequestCost,
  getModelPricing,
} from "../../src/token-cost-calculations";

// Prices from https://platform.claude.com/docs/en/about-claude/pricing (2026-11-01):
// <=100k prompt: $0.10 in, $0.125 5m cache write, $0.01 cache read, $0.50 out per MTok
// >100k prompt:  $0.50 in, $0.625 5m cache write, $0.05 cache read, $2.50 out per MTok
const M = 1_000_000;

describe("claude-haiku-5-5 pricing", () => {
  it("has the base rates", () => {
    const p = getModelPricing("claude-haiku-5-5");
    expect(p.input_cost_per_token).toBeCloseTo(0.1 / M, 15);
    expect(p.output_cost_per_token).toBeCloseTo(0.5 / M, 15);
    expect(p.cache_read_input_token_cost).toBeCloseTo(0.01 / M, 15);
    expect(p.cache_creation_input_token_cost).toBeCloseTo(0.125 / M, 15);
  });

  it("bills a small request at base rates", () => {
    const r = calculateRequestCost("claude-haiku-5-5", 1000, 500, 2000, 300);
    expect(r.actualCost.inputCost).toBeCloseTo(1000 * 0.1 / M, 12);
    expect(r.actualCost.outputCost).toBeCloseTo(500 * 0.5 / M, 12);
    expect(r.actualCost.cacheReadCost).toBeCloseTo(2000 * 0.01 / M, 12);
    expect(r.actualCost.cacheWriteCost).toBeCloseTo(300 * 0.125 / M, 12);
  });

  it("bills exactly 100k prompt tokens at base rates", () => {
    const r = calculateRequestCost("claude-haiku-5-5", 100_000, 1000);
    expect(r.actualCost.inputCost).toBeCloseTo(100_000 * 0.1 / M, 12);
    expect(r.actualCost.outputCost).toBeCloseTo(1000 * 0.5 / M, 12);
  });

  it("bills every category at the higher rate once the whole prompt (incl. cache) is over 100k", () => {
    // Only 10k uncached, but 95k cache read + 5k cache write puts the prompt at 110k.
    const r = calculateRequestCost("claude-haiku-5-5", 10_000, 1000, 95_000, 5_000);
    expect(r.actualCost.inputCost).toBeCloseTo(10_000 * 0.5 / M, 12);
    expect(r.actualCost.outputCost).toBeCloseTo(1000 * 2.5 / M, 12);
    expect(r.actualCost.cacheReadCost).toBeCloseTo(95_000 * 0.05 / M, 12);
    expect(r.actualCost.cacheWriteCost).toBeCloseTo(5_000 * 0.625 / M, 12);
  });

  it("leaves models without a 100k tier unchanged", () => {
    const r = calculateRequestCost("claude-haiku-4-5", 150_000, 1000);
    expect(r.actualCost.inputCost).toBeCloseTo(150_000 * 1 / M, 12);
    expect(r.actualCost.outputCost).toBeCloseTo(1000 * 5 / M, 12);
  });
});
