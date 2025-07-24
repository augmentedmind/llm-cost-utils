import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  extractTokenUsageFromResponseBody,
  extractTokenUsageFromResponse,
  extractTokenUsageFromStreamingResponseBody,
  TokenUsageExtractionError,
  TokenUsageWithModel,
} from "../../src/token-usage-extraction.js";
import { TokenUsage } from "../../src/token-cost-calculations.js";
import fs from "fs";
import path from "path";

describe("Token Usage Extraction", () => {
  describe("extractTokenUsageFromResponseBody", () => {
    it("should extract token usage from standard format", () => {
      const responseBody = {
        usage: {
          input_tokens: 100,
          completion_tokens: 50,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      };

      const result = extractTokenUsageFromResponseBody(responseBody);

      expect(result.promptCacheMissTokens).toBe(100);
      expect(result.completionTokens).toBe(50);
      expect(result.totalInputTokens).toBe(100);
      expect(result.totalOutputTokens).toBe(50);
    });

    it("should extract token usage with cache information", () => {
      const responseBody = {
        usage: {
          input_tokens: 0,
          completion_tokens: 93,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 147251,
        },
      };

      const result = extractTokenUsageFromResponseBody(responseBody);

      expect(result.promptCacheMissTokens).toBe(0);
      expect(result.promptCacheHitTokens).toBe(0);
      expect(result.promptCacheWriteTokens).toBe(147251);
      expect(result.completionTokens).toBe(93);
      expect(result.totalInputTokens).toBe(147251);
      expect(result.totalOutputTokens).toBe(93);
    });

    it("should handle Anthropic format", () => {
      const responseBody = {
        usageMetadata: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      };

      const result = extractTokenUsageFromResponseBody(responseBody);

      expect(result.promptCacheMissTokens).toBe(100);
      expect(result.completionTokens).toBe(50);
      expect(result.totalInputTokens).toBe(100);
      expect(result.totalOutputTokens).toBe(50);
    });

    it("should handle usage_object format", () => {
      const responseBody = {
        usage_object: {
          input_tokens: 100,
          completion_tokens: 50,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      };

      const result = extractTokenUsageFromResponseBody(responseBody);

      expect(result.promptCacheMissTokens).toBe(100);
      expect(result.completionTokens).toBe(50);
      expect(result.totalInputTokens).toBe(100);
      expect(result.totalOutputTokens).toBe(50);
    });

    it("should handle Google AI Studio format", () => {
      const responseBody = {
        promptTokenCount: 100,
        candidatesTokenCount: 50,
      };

      const result = extractTokenUsageFromResponseBody(responseBody);

      expect(result.promptCacheMissTokens).toBe(100);
      expect(result.completionTokens).toBe(50);
      expect(result.totalInputTokens).toBe(100);
      expect(result.totalOutputTokens).toBe(50);
    });

    it("should handle reasoning tokens", () => {
      const responseBody = {
        usage: {
          input_tokens: 100,
          completion_tokens: 70,
          completion_tokens_details: {
            reasoningTokens: 20,
          },
        },
      };

      const result = extractTokenUsageFromResponseBody(responseBody);

      expect(result.promptCacheMissTokens).toBe(100);
      expect(result.reasoningTokens).toBe(20);
      expect(result.completionTokens).toBe(50); // 70 - 20
      expect(result.totalInputTokens).toBe(100);
      expect(result.totalOutputTokens).toBe(70);
    });

    it("should handle the streaming response example", () => {
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
      };

      // Next to last message data
      const messageDelta = {
        usage: {
          output_tokens: 93,
        },
      };

      // Test message_start extraction
      const startResult = extractTokenUsageFromResponseBody(messageStart);
      expect(startResult.promptCacheWriteTokens).toBe(147251);
      expect(startResult.totalInputTokens).toBe(147251);

      // Test message_delta extraction
      const deltaResult = extractTokenUsageFromResponseBody(messageDelta);
      expect(deltaResult.completionTokens).toBe(93);
      expect(deltaResult.totalOutputTokens).toBe(93);
    });

    // Additional tests from token-cost-calculations.test.ts
    it("should extract token usage from OpenAI format", () => {
      const metadata = {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
        },
      };

      const usage = extractTokenUsageFromResponseBody(metadata);

      expect(usage.promptCacheMissTokens).toBe(100);
      expect(usage.reasoningTokens).toBe(0);
      expect(usage.completionTokens).toBe(50);
      expect(usage.totalOutputTokens).toBe(50);
      expect(usage.promptCacheHitTokens).toBe(0);
      expect(usage.promptCacheWriteTokens).toBe(0);
      expect(usage.totalInputTokens).toBe(100);
    });

    it("should extract token usage with cache info (including write tokens)", () => {
      const metadata = {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          cache_read_tokens: 20,
          cache_write_tokens: 30,
        },
      };

      const usage = extractTokenUsageFromResponseBody(metadata);

      expect(usage.promptCacheMissTokens).toBe(100);
      expect(usage.reasoningTokens).toBe(0);
      expect(usage.completionTokens).toBe(50);
      expect(usage.totalOutputTokens).toBe(50);
      expect(usage.promptCacheHitTokens).toBe(20);
      expect(usage.promptCacheWriteTokens).toBe(30);
      expect(usage.totalInputTokens).toBe(150); // 100 + 20 + 30 (including cache write tokens)
    });

    it("should extract OpenAI format with reasoning tokens (including write tokens)", () => {
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
      });
      expect(usage.promptCacheMissTokens).toBe(100);
      expect(usage.completionTokens).toBe(30);
      expect(usage.reasoningTokens).toBe(20);
      expect(usage.totalOutputTokens).toBe(50);
      expect(usage.promptCacheHitTokens).toBe(20);
      expect(usage.promptCacheWriteTokens).toBe(30);
      expect(usage.totalInputTokens).toBe(150); // 100 + 20 + 30 (including cache write tokens)
    });

    it("should extract OpenAI format with cached tokens from prompt_tokens_details", () => {
      // This test case specifically addresses the bug where cached_tokens from
      // prompt_tokens_details was not being extracted properly
      const responseBody = {
        usage: {
          prompt_tokens: 2568,
          completion_tokens: 268,
          prompt_tokens_details: {
            cached_tokens: 1280,
          },
        },
        model: "gpt-4o-2024-11-20",
      };

      const result = extractTokenUsageFromResponseBody(responseBody);

      expect(result.promptCacheHitTokens).toBe(1280);
      expect(result.promptCacheMissTokens).toBe(1288); // 2568 - 1280
      expect(result.completionTokens).toBe(268);
      expect(result.totalInputTokens).toBe(2568); // 1288 + 1280
      expect(result.totalOutputTokens).toBe(268);
      expect(result.model).toBe("gpt-4o-2024-11-20");
    });

    it("should extract token usage from usage_object format (including write tokens)", () => {
      const metadata = {
        usage_object: {
          input_tokens: 100,
          completion_tokens: 50,
          cache_read_input_tokens: 20,
          cache_creation_input_tokens: 30,
        },
      };

      const usage = extractTokenUsageFromResponseBody(metadata);

      expect(usage.promptCacheMissTokens).toBe(100);
      expect(usage.reasoningTokens).toBe(0);
      expect(usage.completionTokens).toBe(50);
      expect(usage.totalOutputTokens).toBe(50);
      expect(usage.promptCacheHitTokens).toBe(20);
      expect(usage.promptCacheWriteTokens).toBe(30);
      expect(usage.totalInputTokens).toBe(150); // 100 + 20 + 30 (including cache write tokens)
    });

    it("should extract token usage with reasoning tokens (including write tokens)", () => {
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
      };

      const usage = extractTokenUsageFromResponseBody(metadata);

      expect(usage.promptCacheMissTokens).toBe(100);
      expect(usage.reasoningTokens).toBe(20);
      expect(usage.completionTokens).toBe(30);
      expect(usage.totalOutputTokens).toBe(50);
      expect(usage.promptCacheHitTokens).toBe(20);
      expect(usage.promptCacheWriteTokens).toBe(30);
      expect(usage.totalInputTokens).toBe(150); // 100 + 20 + 30 (including cache write tokens)
    });

    it("should extract token usage from OpenAI with reasoning tokens", () => {
      const metadata = {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          completion_tokens_details: {
            reasoningTokens: 20,
          },
        },
      };

      const usage = extractTokenUsageFromResponseBody(metadata);

      expect(usage.promptCacheMissTokens).toBe(100);
      expect(usage.reasoningTokens).toBe(20);
      expect(usage.completionTokens).toBe(30);
      expect(usage.totalOutputTokens).toBe(50);
      expect(usage.promptCacheHitTokens).toBe(0);
      expect(usage.promptCacheWriteTokens).toBe(0);
      expect(usage.totalInputTokens).toBe(100);
    });

    it("should handle empty metadata", () => {
      // Empty object should throw an error since there's no token usage information
      expect(() => extractTokenUsageFromResponseBody({})).toThrow(
        TokenUsageExtractionError,
      );
      expect(() => extractTokenUsageFromResponseBody({})).toThrow(
        "Token usage extraction failed: no token usage information in response",
      );
    });

    it("should throw error when no token usage information is present", () => {
      // A response object that has no actual token usage data
      const emptyUsageResponse = {
        id: "response-123",
        model: "test-model",
        choices: [{ message: { content: "Test content" } }],
      };

      // Should throw an error since there's no token usage information
      expect(() =>
        extractTokenUsageFromResponseBody(emptyUsageResponse),
      ).toThrow(TokenUsageExtractionError);
      expect(() =>
        extractTokenUsageFromResponseBody(emptyUsageResponse),
      ).toThrow(
        "Token usage extraction failed: no token usage information in response",
      );
    });

    it("should throw error for null metadata", () => {
      expect(() => extractTokenUsageFromResponseBody(null)).toThrow(
        "Token usage extraction failed: responseBody is null or undefined",
      );
    });

    it("should throw error for undefined metadata", () => {
      expect(() => extractTokenUsageFromResponseBody(undefined)).toThrow(
        "Token usage extraction failed: responseBody is null or undefined",
      );
    });

    it("should throw error when accessing properties throws an error", () => {
      // Create an object that will throw an error when accessed
      const badObject = {
        get usage() {
          throw new Error("Test error");
        },
      };

      // Expect the function to throw an error when accessing the usage property
      expect(() => extractTokenUsageFromResponseBody(badObject)).toThrow();
    });

    it("should handle Gemini 2.0 Flash format correctly", () => {
      const responseBody = {
        candidates: [
          {
            content: {
              parts: [{ text: "Sample response text" }],
              role: "model",
            },
            finishReason: "STOP",
            avgLogprobs: -0.31035351753234863,
          },
        ],
        usageMetadata: {
          promptTokenCount: 4799,
          candidatesTokenCount: 80,
          totalTokenCount: 4879,
          promptTokensDetails: [{ modality: "TEXT", tokenCount: 4799 }],
          candidatesTokensDetails: [{ modality: "TEXT", tokenCount: 80 }],
        },
        modelVersion: "gemini-2.0-flash",
      };

      const result = extractTokenUsageFromResponseBody(responseBody);

      expect(result.promptCacheMissTokens).toBe(4799);
      expect(result.completionTokens).toBe(80);
      expect(result.totalInputTokens).toBe(4799);
      expect(result.totalOutputTokens).toBe(80);
    });

    it("should handle the exact Gemini 2.0 Flash response example provided by the user", () => {
      const responseBody = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "Okay, I'm ready to analyze the user's request and minimize it. I'll focus on identifying redundant information, verbose logs, and unnecessary details to reduce the overall size of the request while ensuring the LLM can still fulfill its task. I will focus on the \"Top 5 Largest Contributions\" and work my way down the list.\n\nI need the messages to proceed.\n",
                },
              ],
              role: "model",
            },
            finishReason: "STOP",
            avgLogprobs: -0.31035351753234863,
          },
        ],
        usageMetadata: {
          promptTokenCount: 4799,
          candidatesTokenCount: 80,
          totalTokenCount: 4879,
          promptTokensDetails: [{ modality: "TEXT", tokenCount: 4799 }],
          candidatesTokensDetails: [{ modality: "TEXT", tokenCount: 80 }],
        },
        modelVersion: "gemini-2.0-flash",
      };

      const result = extractTokenUsageFromResponseBody(responseBody);

      expect(result.promptCacheMissTokens).toBe(4799);
      expect(result.completionTokens).toBe(80);
      expect(result.totalInputTokens).toBe(4799);
      expect(result.totalOutputTokens).toBe(80);
    });

    it("should extract token usage from Mistral response", () => {
      const mistralResponse = {
        id: "16223cd94bf04be9a23dcd4393d13cb9",
        object: "chat.completion",
        model: "mistral-small-latest",
        usage: {
          promptTokens: 2714,
          completionTokens: 121,
          totalTokens: 2835,
        },
        created: 1744697549,
        choices: [
          {
            index: 0,
            message: {
              content: "foo",
              toolCalls: null,
              prefix: false,
              role: "assistant",
            },
            finishReason: "stop",
          },
        ],
      };

      const result = extractTokenUsageFromResponseBody(mistralResponse);
      expect(result).toEqual({
        promptCacheMissTokens: 2714,
        promptCacheHitTokens: 0,
        reasoningTokens: 0,
        completionTokens: 121,
        totalOutputTokens: 121,
        totalInputTokens: 2714,
        promptCacheWriteTokens: 0,
        model: "mistral-small-latest",
      });
    });

    it("should handle Mistral response with missing usage fields", () => {
      const mistralResponse = {
        id: "16223cd94bf04be9a23dcd4393d13cb9",
        object: "chat.completion",
        model: "mistral-small-latest",
        usage: {},
        created: 1744697549,
        choices: [
          {
            index: 0,
            message: {
              content: "foo",
              toolCalls: null,
              prefix: false,
              role: "assistant",
            },
            finishReason: "stop",
          },
        ],
      };

      // Should throw an error since there's no token usage information
      expect(() => extractTokenUsageFromResponseBody(mistralResponse)).toThrow(
        TokenUsageExtractionError,
      );
      expect(() => extractTokenUsageFromResponseBody(mistralResponse)).toThrow(
        "Token usage extraction failed: no token usage information in response",
      );
    });

    it("should handle Mistral response with partial usage fields", () => {
      const mistralResponse = {
        id: "16223cd94bf04be9a23dcd4393d13cb9",
        object: "chat.completion",
        model: "mistral-small-latest",
        usage: {
          promptTokens: 2714,
        },
        created: 1744697549,
        choices: [
          {
            index: 0,
            message: {
              content: "foo",
              toolCalls: null,
              prefix: false,
              role: "assistant",
            },
            finishReason: "stop",
          },
        ],
      };

      const result = extractTokenUsageFromResponseBody(mistralResponse);
      expect(result).toEqual({
        promptCacheMissTokens: 2714,
        promptCacheHitTokens: 0,
        reasoningTokens: 0,
        completionTokens: 0,
        totalOutputTokens: 0,
        totalInputTokens: 2714,
        promptCacheWriteTokens: 0,
        model: "mistral-small-latest",
      });
    });
  });

  // Add tests for SSE streaming responses
  describe("extractTokenUsageFromStreamingResponseBody and extractTokenUsageFromResponse", () => {
    it("should extract token usage and model from OpenAI SSE with usage data", () => {
      // Read the OpenAI SSE fixture with usage data
      const sseContent = fs.readFileSync(
        path.join(__dirname, "fixtures/openai-sse-with-usage.txt"),
        "utf-8",
      );

      // Extract token usage from the SSE content
      const result = extractTokenUsageFromResponse(sseContent);

      // Verify the token usage values
      expect(result.promptCacheMissTokens).toBe(10);
      expect(result.completionTokens).toBe(10);
      expect(result.totalOutputTokens).toBe(10);
      expect(result.totalInputTokens).toBe(10);
      expect(result.model).toBe("gpt-4o-2024-08-06");
    });

    it("should throw an error for OpenAI SSE without usage data", () => {
      // Read the OpenAI SSE fixture without usage data
      const sseContent = fs.readFileSync(
        path.join(__dirname, "fixtures/openai-sse-without-usage.txt"),
        "utf-8",
      );

      // The function should throw a TokenUsageExtractionError since there's no usage data
      expect(() => extractTokenUsageFromResponse(sseContent)).toThrow(
        TokenUsageExtractionError,
      );
      expect(() => extractTokenUsageFromResponse(sseContent)).toThrow(
        "no token usage information found in streaming response",
      );
    });

    it("should throw an error for individual SSE message without usage", () => {
      // Properly formatted SSE message with data: prefix and newlines
      const sseMessage =
        'data: {"id":"chatcmpl-123","model":"gpt-4o-2024-08-06","choices":[{"delta":{"content":"Hello"}}]}\n\n';

      // Should throw an error since there's no token usage information
      expect(() => extractTokenUsageFromResponse(sseMessage)).toThrow(
        TokenUsageExtractionError,
      );
      expect(() => extractTokenUsageFromResponse(sseMessage)).toThrow(
        "no token usage information found in streaming response",
      );
    });

    it("should handle SSE without proper newlines between events", () => {
      // Read the edge case fixture
      const sseContent = fs.readFileSync(
        path.join(
          __dirname,
          "fixtures/edge-cases/sse-without-proper-newlines.txt",
        ),
        "utf-8",
      );

      const result = extractTokenUsageFromResponse(sseContent);

      // Should extract model and token usage
      expect(result.model).toBe("gpt-4o-2024-08-06");
      expect(result.promptCacheMissTokens).toBe(10);
      expect(result.completionTokens).toBe(10);
      expect(result.totalInputTokens).toBe(10);
      expect(result.totalOutputTokens).toBe(10);
    });
  });

  describe("AI SDK (Vercel AI SDK) format support", () => {
    it("should extract token usage from AI SDK format with nested usage object", () => {
      const aiSdkResponse = {
        model: "gpt-4o",
        usage: {
          promptTokens: 91,
          completionTokens: 38,
          totalTokens: 129,
        },
        providerMetadata: {
          openai: {
            cachedPromptTokens: 0,
            reasoningTokens: 0,
            acceptedPredictionTokens: 0,
            rejectedPredictionTokens: 0,
          },
        },
      };

      const result = extractTokenUsageFromResponseBody(aiSdkResponse);

      expect(result.promptCacheMissTokens).toBe(91);
      expect(result.promptCacheHitTokens).toBe(0);
      expect(result.reasoningTokens).toBe(0);
      expect(result.completionTokens).toBe(38);
      expect(result.totalOutputTokens).toBe(38);
      expect(result.totalInputTokens).toBe(91);
      expect(result.promptCacheWriteTokens).toBe(0);
      expect(result.model).toBe("gpt-4o");
    });

    it("should handle AI SDK format with nested usage and cached tokens", () => {
      const aiSdkResponse = {
        model: "gpt-4o",
        usage: {
          promptTokens: 200,
          completionTokens: 50,
          totalTokens: 250,
        },
        providerMetadata: {
          openai: {
            cachedPromptTokens: 100,
            reasoningTokens: 5,
            acceptedPredictionTokens: 0,
            rejectedPredictionTokens: 0,
          },
        },
      };

      const result = extractTokenUsageFromResponseBody(aiSdkResponse);

      expect(result.promptCacheMissTokens).toBe(100); // 200 - 100 cached
      expect(result.promptCacheHitTokens).toBe(100);
      expect(result.reasoningTokens).toBe(5);
      expect(result.completionTokens).toBe(45); // 50 - 5 reasoning
      expect(result.totalOutputTokens).toBe(50); // 45 + 5
      expect(result.totalInputTokens).toBe(200);
      expect(result.promptCacheWriteTokens).toBe(0);
      expect(result.model).toBe("gpt-4o");
    });

    it("should handle AI SDK format with Anthropic provider metadata", () => {
      const aiSdkResponse = {
        model: "claude-3-5-sonnet",
        usage: {
          promptTokens: 200,
          completionTokens: 100,
          totalTokens: 300,
        },
        providerMetadata: {
          anthropic: {
            cacheReadInputTokens: 50,
          },
        },
      };

      const result = extractTokenUsageFromResponseBody(aiSdkResponse);

      expect(result.promptCacheMissTokens).toBe(150); // 200 - 50 cached
      expect(result.promptCacheHitTokens).toBe(50);
      expect(result.reasoningTokens).toBe(0); // Anthropic doesn't provide reasoning breakdown yet
      expect(result.completionTokens).toBe(100);
      expect(result.totalOutputTokens).toBe(100);
      expect(result.totalInputTokens).toBe(200);
      expect(result.promptCacheWriteTokens).toBe(0);
      expect(result.model).toBe("claude-3-5-sonnet");
    });

    it("should handle AI SDK format with Anthropic cache creation tokens", () => {
      const aiSdkResponse = {
        model: "claude-sonnet-4-20250514",
        usage: {
          promptTokens: 27,
          completionTokens: 40,
          totalTokens: 67,
        },
        providerMetadata: {
          anthropic: {
            cacheCreationInputTokens: 8529,
            cacheReadInputTokens: 0,
          },
        },
      };

      const result = extractTokenUsageFromResponseBody(aiSdkResponse);

      expect(result.promptCacheMissTokens).toBe(27); // 27 - 0 cached
      expect(result.promptCacheHitTokens).toBe(0);
      expect(result.promptCacheWriteTokens).toBe(8529); // Cache write tokens from metadata
      expect(result.reasoningTokens).toBe(0);
      expect(result.completionTokens).toBe(40);
      expect(result.totalOutputTokens).toBe(40);
      expect(result.totalInputTokens).toBe(8556); // 27 + 0 + 8529
      expect(result.model).toBe("claude-sonnet-4-20250514");
    });

    it("should handle AI SDK format with both Anthropic cache read and write tokens", () => {
      const aiSdkResponse = {
        model: "claude-sonnet-4-20250514",
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        providerMetadata: {
          anthropic: {
            cacheCreationInputTokens: 2000,
            cacheReadInputTokens: 50,
          },
        },
      };

      const result = extractTokenUsageFromResponseBody(aiSdkResponse);

      expect(result.promptCacheMissTokens).toBe(50); // 100 - 50 cached
      expect(result.promptCacheHitTokens).toBe(50);
      expect(result.promptCacheWriteTokens).toBe(2000); // Cache write tokens
      expect(result.reasoningTokens).toBe(0);
      expect(result.completionTokens).toBe(50);
      expect(result.totalOutputTokens).toBe(50);
      expect(result.totalInputTokens).toBe(2100); // 50 + 50 + 2000
      expect(result.model).toBe("claude-sonnet-4-20250514");
    });
  });

  it("should throw an error for response body without token usage", () => {
    // A response object that has no actual token usage data
    const emptyUsageResponse = {
      id: "response-123",
      model: "test-model",
      choices: [{ message: { content: "Test content" } }],
    };

    // Should throw an error since there's no token usage information
    expect(() => extractTokenUsageFromResponseBody(emptyUsageResponse)).toThrow(
      TokenUsageExtractionError,
    );
    expect(() => extractTokenUsageFromResponseBody(emptyUsageResponse)).toThrow(
      "Token usage extraction failed: no token usage information in response",
    );
  });
});
