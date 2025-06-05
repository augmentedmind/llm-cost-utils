# Migration Guide: llm-cost-utils 0.1.0 → 0.2.0

This guide will help you migrate from llm-cost-utils 0.1.0 to 0.2.0.

## Breaking Changes

### ✨ Enhanced `calculateRequestCost` Function

The `calculateRequestCost` function now returns comprehensive cost analytics instead of a simple cost breakdown.

#### **Before (0.1.0):**
```typescript
interface RequestCost {
  inputCost: number
  outputCost: number
  cacheReadCost: number
  cacheWriteCost: number
  totalCost: number
}

const cost = calculateRequestCost(model, cacheMissTokens, outputTokens, cacheHitTokens, cacheWriteTokens)
console.log(cost.totalCost) // Access total cost
```

#### **After (0.2.0):**
```typescript
interface RequestCostAnalysis {
  actualCost: CostBreakdown
  uncachedCost: CostBreakdown
  savings: SavingsAnalysis
  cacheStats: CacheStatistics
}

const analysis = calculateRequestCost(model, cacheMissTokens, outputTokens, cacheHitTokens, cacheWriteTokens)
console.log(analysis.actualCost.totalCost) // Access total cost
console.log(analysis.uncachedCost.totalCost) // See what it would cost without cache
console.log(analysis.savings.percentSaved) // See percentage saved
console.log(analysis.cacheStats.hitRate) // See cache hit rate
```

## Migration Steps

### 1. Update Property Access

Replace direct cost property access:

```typescript
// ❌ Old (0.1.0)
const cost = calculateRequestCost(...)
const total = cost.totalCost
const input = cost.inputCost

// ✅ New (0.2.0)
const analysis = calculateRequestCost(...)
const total = analysis.actualCost.totalCost
const input = analysis.actualCost.inputCost
```

### 2. Take Advantage of New Features

Now you can access powerful new analytics:

```typescript
const analysis = calculateRequestCost(model, cacheMissTokens, outputTokens, cacheHitTokens, cacheWriteTokens)

// 💡 What the request actually cost (with caching)
console.log(`Actual cost: $${analysis.actualCost.totalCost.toFixed(6)}`)

// 💡 What it would have cost without caching
console.log(`Uncached cost: $${analysis.uncachedCost.totalCost.toFixed(6)}`)

// 💡 How much you saved
console.log(`Saved: $${analysis.savings.totalSavings.toFixed(6)} (${analysis.savings.percentSaved.toFixed(1)}%)`)

// 💡 Cache performance metrics
console.log(`Cache hit rate: ${(analysis.cacheStats.hitRate * 100).toFixed(1)}%`)
console.log(`Cached tokens: ${analysis.cacheStats.cachedTokens}/${analysis.cacheStats.totalInputTokens}`)
```

### 3. Update Metadata Storage

If you're storing cost data in metadata:

```typescript
// ❌ Old (0.1.0)
const cost = calculateRequestCost(...)
const metadata = {
  cost: cost,
  // ...
}

// ✅ New (0.2.0) - Comprehensive approach
const analysis = calculateRequestCost(...)
const metadata = {
  cost: analysis.actualCost,        // Backwards compatible
  costAnalytics: analysis,          // Full analytics
  // ...
}

// ✅ New (0.2.0) - Clean approach
const analysis = calculateRequestCost(...)
const metadata = {
  costAnalysis: analysis,
  // ...
}
```

## New Interfaces

### `RequestCostAnalysis`
Main return type containing all cost analytics.

### `CostBreakdown`
Detailed cost breakdown (replaces old `RequestCost`):
```typescript
interface CostBreakdown {
  inputCost: number
  outputCost: number
  cacheReadCost: number
  cacheWriteCost: number
  totalCost: number
}
```

### `SavingsAnalysis`
Cache savings analytics:
```typescript
interface SavingsAnalysis {
  inputSavings: number      // How much saved on input costs
  totalSavings: number      // Total amount saved
  percentSaved: number      // Percentage saved (0-100)
}
```

### `CacheStatistics`
Cache performance metrics:
```typescript
interface CacheStatistics {
  hitRate: number           // Cache hit rate (0-1)
  totalInputTokens: number  // Total input tokens
  cachedTokens: number      // Tokens served from cache
  uncachedTokens: number    // Tokens not from cache
}
```

## Benefits of Upgrading

- 📊 **Rich Analytics**: Get comprehensive cost insights in a single call
- 💰 **Savings Tracking**: See exactly how much caching saves you
- 📈 **Performance Metrics**: Monitor cache hit rates and effectiveness
- 🎯 **Better Planning**: Compare actual vs uncached costs for budgeting
- 🔍 **Deeper Insights**: Understand your LLM usage patterns better

## Need Help?

If you have questions about migrating, please check the updated README.md or open an issue in the repository. 