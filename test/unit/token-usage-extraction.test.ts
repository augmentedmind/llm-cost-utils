import { describe, it, expect, vi } from 'vitest'
import { extractTokenUsageFromResponseBody } from '../../src/token-usage-extraction'

describe('Token Usage Extraction', () => {
  describe('extractTokenUsageFromResponseBody', () => {
    it('should extract token usage from standard format', () => {
      const responseBody = {
        usage: {
          input_tokens: 100,
          completion_tokens: 50,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      }

      const result = extractTokenUsageFromResponseBody(responseBody)

      expect(result.promptCacheMissTokens).toBe(100)
      expect(result.completionTokens).toBe(50)
      expect(result.totalInputTokens).toBe(100)
      expect(result.totalOutputTokens).toBe(50)
    })

    it('should extract token usage with cache information', () => {
      const responseBody = {
        usage: {
          input_tokens: 0,
          completion_tokens: 93,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 147251,
        },
      }

      const result = extractTokenUsageFromResponseBody(responseBody)

      expect(result.promptCacheMissTokens).toBe(0)
      expect(result.promptCacheHitTokens).toBe(0)
      expect(result.promptCacheWriteTokens).toBe(147251)
      expect(result.completionTokens).toBe(93)
      expect(result.totalInputTokens).toBe(147251)
      expect(result.totalOutputTokens).toBe(93)
    })

    it('should handle Anthropic format', () => {
      const responseBody = {
        usageMetadata: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      }

      const result = extractTokenUsageFromResponseBody(responseBody)

      expect(result.promptCacheMissTokens).toBe(100)
      expect(result.completionTokens).toBe(50)
      expect(result.totalInputTokens).toBe(100)
      expect(result.totalOutputTokens).toBe(50)
    })

    it('should handle usage_object format', () => {
      const responseBody = {
        usage_object: {
          input_tokens: 100,
          completion_tokens: 50,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      }

      const result = extractTokenUsageFromResponseBody(responseBody)

      expect(result.promptCacheMissTokens).toBe(100)
      expect(result.completionTokens).toBe(50)
      expect(result.totalInputTokens).toBe(100)
      expect(result.totalOutputTokens).toBe(50)
    })

    it('should handle Google AI Studio format', () => {
      const responseBody = {
        promptTokenCount: 100,
        candidatesTokenCount: 50,
      }

      const result = extractTokenUsageFromResponseBody(responseBody)

      expect(result.promptCacheMissTokens).toBe(100)
      expect(result.completionTokens).toBe(50)
      expect(result.totalInputTokens).toBe(100)
      expect(result.totalOutputTokens).toBe(50)
    })

    it('should handle reasoning tokens', () => {
      const responseBody = {
        usage: {
          input_tokens: 100,
          completion_tokens: 70,
          completion_tokens_details: {
            reasoningTokens: 20,
          },
        },
      }

      const result = extractTokenUsageFromResponseBody(responseBody)

      expect(result.promptCacheMissTokens).toBe(100)
      expect(result.reasoningTokens).toBe(20)
      expect(result.completionTokens).toBe(50) // 70 - 20
      expect(result.totalInputTokens).toBe(100)
      expect(result.totalOutputTokens).toBe(70)
    })

    it('should handle the streaming response example', () => {
      // First SSE message data
      const messageStart = {
        message: {
          usage: {
            input_tokens: 0,
            cache_creation_input_tokens: 147251,
            cache_read_input_tokens: 0,
            output_tokens: 1,
          },
        },
      }

      // Next to last message data
      const messageDelta = {
        usage: {
          output_tokens: 93,
        },
      }

      // Test message_start extraction
      const startResult = extractTokenUsageFromResponseBody(messageStart)
      expect(startResult.promptCacheWriteTokens).toBe(147251)
      expect(startResult.totalInputTokens).toBe(147251)

      // Test message_delta extraction
      const deltaResult = extractTokenUsageFromResponseBody(messageDelta)
      expect(deltaResult.completionTokens).toBe(93)
      expect(deltaResult.totalOutputTokens).toBe(93)
    })

    // Additional tests from token-cost-calculations.test.ts
    it('should extract token usage from OpenAI format', () => {
      const metadata = {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
        },
      }

      const usage = extractTokenUsageFromResponseBody(metadata)

      expect(usage.promptCacheMissTokens).toBe(100)
      expect(usage.reasoningTokens).toBe(0)
      expect(usage.completionTokens).toBe(50)
      expect(usage.totalOutputTokens).toBe(50)
      expect(usage.promptCacheHitTokens).toBe(0)
      expect(usage.promptCacheWriteTokens).toBe(0)
      expect(usage.totalInputTokens).toBe(100)
    })

    it('should extract token usage with cache info (including write tokens)', () => {
      const metadata = {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          cache_read_tokens: 20,
          cache_write_tokens: 30,
        },
      }

      const usage = extractTokenUsageFromResponseBody(metadata)

      expect(usage.promptCacheMissTokens).toBe(100)
      expect(usage.reasoningTokens).toBe(0)
      expect(usage.completionTokens).toBe(50)
      expect(usage.totalOutputTokens).toBe(50)
      expect(usage.promptCacheHitTokens).toBe(20)
      expect(usage.promptCacheWriteTokens).toBe(30)
      expect(usage.totalInputTokens).toBe(150) // 100 + 20 + 30 (including cache write tokens)
    })

    it('should extract OpenAI format with reasoning tokens (including write tokens)', () => {
      const usage = extractTokenUsageFromResponseBody({
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          completion_tokens_details: {
            reasoning_tokens: 20,
          },
          cache_read_tokens: 20,
          cache_write_tokens: 30,
        },
      })
      expect(usage.promptCacheMissTokens).toBe(100)
      expect(usage.completionTokens).toBe(30)
      expect(usage.reasoningTokens).toBe(20)
      expect(usage.totalOutputTokens).toBe(50)
      expect(usage.promptCacheHitTokens).toBe(20)
      expect(usage.promptCacheWriteTokens).toBe(30)
      expect(usage.totalInputTokens).toBe(150) // 100 + 20 + 30 (including cache write tokens)
    })

    it('should extract token usage from usage_object format (including write tokens)', () => {
      const metadata = {
        usage_object: {
          input_tokens: 100,
          completion_tokens: 50,
          cache_read_input_tokens: 20,
          cache_creation_input_tokens: 30,
        },
      }

      const usage = extractTokenUsageFromResponseBody(metadata)

      expect(usage.promptCacheMissTokens).toBe(100)
      expect(usage.reasoningTokens).toBe(0)
      expect(usage.completionTokens).toBe(50)
      expect(usage.totalOutputTokens).toBe(50)
      expect(usage.promptCacheHitTokens).toBe(20)
      expect(usage.promptCacheWriteTokens).toBe(30)
      expect(usage.totalInputTokens).toBe(150) // 100 + 20 + 30 (including cache write tokens)
    })

    it('should extract token usage with reasoning tokens (including write tokens)', () => {
      const metadata = {
        usage_object: {
          input_tokens: 100,
          completion_tokens: 50,
          completion_tokens_details: {
            reasoningTokens: 20,
          },
          cache_read_input_tokens: 20,
          cache_creation_input_tokens: 30,
        },
      }

      const usage = extractTokenUsageFromResponseBody(metadata)

      expect(usage.promptCacheMissTokens).toBe(100)
      expect(usage.reasoningTokens).toBe(20)
      expect(usage.completionTokens).toBe(30)
      expect(usage.totalOutputTokens).toBe(50)
      expect(usage.promptCacheHitTokens).toBe(20)
      expect(usage.promptCacheWriteTokens).toBe(30)
      expect(usage.totalInputTokens).toBe(150) // 100 + 20 + 30 (including cache write tokens)
    })

    it('should extract token usage from OpenAI with reasoning tokens', () => {
      const metadata = {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          completion_tokens_details: {
            reasoningTokens: 20,
          },
        },
      }

      const usage = extractTokenUsageFromResponseBody(metadata)

      expect(usage.promptCacheMissTokens).toBe(100)
      expect(usage.reasoningTokens).toBe(20)
      expect(usage.completionTokens).toBe(30)
      expect(usage.totalOutputTokens).toBe(50)
      expect(usage.promptCacheHitTokens).toBe(0)
      expect(usage.promptCacheWriteTokens).toBe(0)
      expect(usage.totalInputTokens).toBe(100)
    })

    it('should handle empty metadata', () => {
      // Empty object is valid input, just has no token usage data
      const usage = extractTokenUsageFromResponseBody({})

      expect(usage.promptCacheMissTokens).toBe(0)
      expect(usage.reasoningTokens).toBe(0)
      expect(usage.completionTokens).toBe(0)
      expect(usage.totalOutputTokens).toBe(0)
      expect(usage.promptCacheHitTokens).toBe(0)
      expect(usage.promptCacheWriteTokens).toBe(0)
      expect(usage.totalInputTokens).toBe(0)
    })

    it('should throw error for null metadata', () => {
      expect(() => extractTokenUsageFromResponseBody(null)).toThrow('Token usage extraction failed: responseBody is null or undefined')
    })

    it('should throw error for undefined metadata', () => {
      expect(() => extractTokenUsageFromResponseBody(undefined)).toThrow('Token usage extraction failed: responseBody is null or undefined')
    })

    it('should throw error when accessing properties throws an error', () => {
      // Create an object that will throw an error when accessed
      const badObject = {
        get usage() {
          throw new Error('Test error')
        },
      }

      // Expect the function to throw an error when accessing the usage property
      expect(() => extractTokenUsageFromResponseBody(badObject)).toThrow()
    })

    it('should handle Gemini 2.0 Flash format correctly', () => {
      const responseBody = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Sample response text' }],
              role: 'model',
            },
            finishReason: 'STOP',
            avgLogprobs: -0.31035351753234863,
          },
        ],
        usageMetadata: {
          promptTokenCount: 4799,
          candidatesTokenCount: 80,
          totalTokenCount: 4879,
          promptTokensDetails: [{ modality: 'TEXT', tokenCount: 4799 }],
          candidatesTokensDetails: [{ modality: 'TEXT', tokenCount: 80 }],
        },
        modelVersion: 'gemini-2.0-flash',
      }

      const result = extractTokenUsageFromResponseBody(responseBody)

      expect(result.promptCacheMissTokens).toBe(4799)
      expect(result.completionTokens).toBe(80)
      expect(result.totalInputTokens).toBe(4799)
      expect(result.totalOutputTokens).toBe(80)
    })

    it('should handle the exact Gemini 2.0 Flash response example provided by the user', () => {
      const responseBody = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "Okay, I'm ready to analyze the user's request and minimize it. I'll focus on identifying redundant information, verbose logs, and unnecessary details to reduce the overall size of the request while ensuring the LLM can still fulfill its task. I will focus on the \"Top 5 Largest Contributions\" and work my way down the list.\n\nI need the messages to proceed.\n",
                },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
            avgLogprobs: -0.31035351753234863,
          },
        ],
        usageMetadata: {
          promptTokenCount: 4799,
          candidatesTokenCount: 80,
          totalTokenCount: 4879,
          promptTokensDetails: [{ modality: 'TEXT', tokenCount: 4799 }],
          candidatesTokensDetails: [{ modality: 'TEXT', tokenCount: 80 }],
        },
        modelVersion: 'gemini-2.0-flash',
      }

      const result = extractTokenUsageFromResponseBody(responseBody)

      expect(result.promptCacheMissTokens).toBe(4799)
      expect(result.completionTokens).toBe(80)
      expect(result.totalInputTokens).toBe(4799)
      expect(result.totalOutputTokens).toBe(80)
    })
  })
})
