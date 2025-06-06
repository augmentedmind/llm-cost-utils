// token-usage-extraction.ts
// Extracts token usage information from API responses

import { TokenUsage } from './token-cost-calculations'

/**
 * Custom error class for token usage extraction failures
 * This allows the calling code to specifically identify token usage extraction errors
 * and handle them appropriately (e.g., not retry them)
 */
export class TokenUsageExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenUsageExtractionError'
  }
}

/**
 * Extended TokenUsage interface that includes model information
 */
export interface TokenUsageWithModel extends TokenUsage {
  model?: string
}

/**
 * Extract token usage from a response body object
 * This is the core function that handles all the different formats of token usage data
 */
export function extractTokenUsageFromResponseBody(responseBody: any): TokenUsageWithModel {
  // Throw error for null or undefined input
  if (responseBody === null || responseBody === undefined) {
    throw new TokenUsageExtractionError('Token usage extraction failed: responseBody is null or undefined')
  }

  // Default values
  let promptCacheMissTokens = 0
  let promptCacheHitTokens = 0
  let reasoningTokens = 0
  let completionTokens = 0
  let totalOutputTokens = 0
  let totalInputTokens = 0
  let promptCacheWriteTokens = 0
  let model: string | undefined = undefined

  // Extract model information if available
  if (responseBody.model) {
    model = responseBody.model
  } else if (responseBody.id && typeof responseBody.id === 'string' && responseBody.id.startsWith('cmpl-')) {
    // OpenAI completion ID, try to extract model from object
    model = responseBody.model || undefined
  }

  // Handle message_start event from streaming responses
  if (responseBody?.message?.usage) {
    // Extract input tokens and cache info from message_start
    promptCacheMissTokens = responseBody.message.usage.input_tokens || responseBody.message.usage.prompt_tokens || 0

    // Extract cache hit tokens
    promptCacheHitTokens = responseBody.message.usage.cache_read_input_tokens || responseBody.message.usage.cache_read_tokens || 0

    // Extract cache write tokens
    promptCacheWriteTokens = responseBody.message.usage.cache_creation_input_tokens || responseBody.message.usage.cache_write_tokens || 0

    // Extract completion tokens
    completionTokens = responseBody.message.usage.completion_tokens || responseBody.message.usage.output_tokens || 0

    // Try to get model from message
    if (!model && responseBody.message.model) {
      model = responseBody.message.model
    }
  } else if (responseBody.usage && responseBody.usage.promptTokens !== undefined && responseBody.usage.completionTokens !== undefined) {
    // Format for AI SDK (Vercel AI SDK)
    // Format: { model: "gpt-4o", usage: { promptTokens: 91, completionTokens: 38, totalTokens: 129 }, providerMetadata: {...} }
    
    // Extract basic token counts from nested usage
    const aiSdkPromptTokens = responseBody.usage.promptTokens || 0
    const aiSdkCompletionTokens = responseBody.usage.completionTokens || 0
    
    // Extract provider-specific metadata if available
    let cachedTokens = 0
    let aiSdkReasoningTokens = 0
    
    if (responseBody.providerMetadata?.openai) {
      // Azure OpenAI / OpenAI provider metadata
      cachedTokens = responseBody.providerMetadata.openai.cachedPromptTokens || 0
      aiSdkReasoningTokens = responseBody.providerMetadata.openai.reasoningTokens || 0
    } else if (responseBody.providerMetadata?.anthropic) {
      // Anthropic provider metadata
      cachedTokens = responseBody.providerMetadata.anthropic.cacheReadInputTokens || 0
      // Extract cache write tokens for Anthropic
      promptCacheWriteTokens = responseBody.providerMetadata.anthropic.cacheCreationInputTokens || 0
    }
    
    // Calculate cache miss tokens (prompt tokens that weren't cached)
    promptCacheMissTokens = Math.max(0, aiSdkPromptTokens - cachedTokens)
    promptCacheHitTokens = cachedTokens
    
    // Handle reasoning vs completion token breakdown
    reasoningTokens = aiSdkReasoningTokens
    completionTokens = Math.max(0, aiSdkCompletionTokens - aiSdkReasoningTokens)
    
    // Extract model if available
    if (responseBody.model) {
      model = responseBody.model
    }
  } else if (responseBody?.usage) {
    // Handle Mistral format
    if (responseBody.model?.startsWith('mistral-')) {
      promptCacheMissTokens = responseBody.usage.promptTokens || 0
      completionTokens = responseBody.usage.completionTokens || 0
      model = responseBody.model
    } else {
      // Extract input tokens and cache info
      promptCacheMissTokens = responseBody.usage.input_tokens || responseBody.usage.prompt_tokens || 0

      // Extract reasoning tokens if available
      if (responseBody.usage.completion_tokens_details?.reasoning_tokens !== undefined) {
        reasoningTokens = responseBody.usage.completion_tokens_details.reasoning_tokens || 0
      } else if (responseBody.usage.completion_tokens_details?.reasoningTokens !== undefined) {
        reasoningTokens = responseBody.usage.completion_tokens_details.reasoningTokens || 0
      } else {
        reasoningTokens = responseBody.usage.reasoningTokens || 0
      }

      // Extract completion tokens
      completionTokens = responseBody.usage.completion_tokens || responseBody.usage.output_tokens || 0

      // If we have reasoning tokens, subtract them from completion tokens
      if (reasoningTokens > 0 && completionTokens > 0) {
        completionTokens = completionTokens - reasoningTokens
      }

      // Extract cache hit tokens - check OpenAI format first
      if (responseBody.usage.prompt_tokens_details?.cached_tokens !== undefined) {
        promptCacheHitTokens = responseBody.usage.prompt_tokens_details.cached_tokens || 0
        // Adjust promptCacheMissTokens to exclude cached tokens for OpenAI format
        const totalPromptTokens = responseBody.usage.prompt_tokens || 0
        promptCacheMissTokens = Math.max(0, totalPromptTokens - promptCacheHitTokens)
      } else {
        // Fallback to other formats
        promptCacheHitTokens = responseBody.usage.cache_read_input_tokens || responseBody.usage.cache_read_tokens || 0
      }

      // Extract cache write tokens
      promptCacheWriteTokens = responseBody.usage.cache_creation_input_tokens || responseBody.usage.cache_write_tokens || 0
    }
  } else if (responseBody.usageMetadata) {
    // Handle different usageMetadata formats
    if (responseBody.usageMetadata.promptTokenCount !== undefined && responseBody.usageMetadata.candidatesTokenCount !== undefined) {
      // Gemini 2.0 Flash format
      promptCacheMissTokens = responseBody.usageMetadata.promptTokenCount || 0
      completionTokens = responseBody.usageMetadata.candidatesTokenCount || 0

      // Try to extract model for Google/Gemini
      if (responseBody.model) {
        model = responseBody.model
      }
    } else {
      // Anthropic format
      promptCacheMissTokens = responseBody.usageMetadata.input_tokens || 0

      // For Anthropic, we don't have reasoning vs completion breakdown yet
      completionTokens = responseBody.usageMetadata.output_tokens || 0

      // Check for cache info if available
      if (responseBody.usageMetadata.cache_read_input_tokens) {
        promptCacheHitTokens = responseBody.usageMetadata.cache_read_input_tokens
      }

      if (responseBody.usageMetadata.cache_creation_input_tokens) {
        promptCacheWriteTokens = responseBody.usageMetadata.cache_creation_input_tokens
      }

      // Try to extract model from Anthropic response
      if (responseBody.model) {
        model = responseBody.model
      }
    }
  } else if (responseBody.usage_object) {
    // Extract usage object
    const usage = responseBody.usage_object

    // Extract input tokens
    promptCacheMissTokens = usage.input_tokens || usage.prompt_tokens || 0

    // Extract output tokens with reasoning/completion breakdown if available
    if (usage.completion_tokens_details?.reasoningTokens !== undefined) {
      reasoningTokens = usage.completion_tokens_details.reasoningTokens || 0
      completionTokens = (usage.completion_tokens || 0) - reasoningTokens
    } else {
      // If no breakdown, all completion tokens are considered completion
      completionTokens = usage.completion_tokens || 0
    }

    // Extract cache read tokens
    promptCacheHitTokens = usage.cache_read_input_tokens || 0

    // Extract cache write tokens
    promptCacheWriteTokens = usage.cache_creation_input_tokens || 0

    // Try to extract model from response
    if (responseBody.model) {
      model = responseBody.model
    }
  } else if (responseBody.promptTokenCount) {
    // Google AI Studio format
    promptCacheMissTokens = responseBody.promptTokenCount || 0
    completionTokens = responseBody.candidatesTokenCount || 0

    // Try to extract model
    if (responseBody.model) {
      model = responseBody.model
    }
  }

  // Calculate total values
  totalOutputTokens = reasoningTokens + completionTokens
  totalInputTokens = promptCacheMissTokens + promptCacheHitTokens + promptCacheWriteTokens

  // Check if we have no token usage information
  if (totalInputTokens === 0 && totalOutputTokens === 0) {
    throw new TokenUsageExtractionError(`Token usage extraction failed: no token usage information in response`)
  }

  return {
    promptCacheMissTokens,
    promptCacheHitTokens,
    reasoningTokens,
    completionTokens,
    totalOutputTokens,
    totalInputTokens,
    promptCacheWriteTokens,
    model,
  }
}

/**
 * Determines if the response body is likely a SSE stream based on its content
 */
export function isSSEResponseBody(responseBody: string | object): boolean {
  // If it's already an object, it's not SSE
  if (typeof responseBody !== 'string') {
    return false
  }

  // Check for SSE format indicators
  // 1. Contains 'data: ' prefix
  // 2. Contains newlines between events or has the 'event:' prefix
  // 3. SSE typically ends with [DONE] for completions
  // 4. Check for data: {"id":"chatcmpl- pattern for OpenAI responses
  return (responseBody.includes('data: ') &&
         (responseBody.includes('\n\n') ||
          responseBody.includes('event:'))) ||
         responseBody.includes('data: [DONE]') ||
         (responseBody.includes('data: {"id":"chatcmpl-') ||
          responseBody.includes('data: {"model":'))
}

/**
 * Extract token usage from a streaming response by parsing SSE events
 */
export function extractTokenUsageFromStreamingResponseBody(responseText: string): TokenUsageWithModel {
  // Throw error for null or undefined response
  if (!responseText) {
    throw new TokenUsageExtractionError('Token usage extraction failed: response text is null or undefined')
  }

  // Check for error events in the stream
  if (responseText.includes('event: error') || responseText.includes('"type":"error"')) {
    throw new TokenUsageExtractionError('Token usage extraction failed: error event detected in stream')
  }

  // Parse SSE events - handle both proper newlines (\n\n) and improper formatting (just data: prefixes)
  let events = responseText.split('\n\n').filter((event) => event.trim() !== '')

  // If we don't have multiple events with proper newlines, try to split by data: instead
  if (events.length <= 1 && responseText.includes('data: ')) {
    // This is a workaround for SSE streams without proper newlines
    const dataLines = responseText.split('data: ')
    events = dataLines.filter(line => line.trim() !== '').map(line => `data: ${line}`)
  }

  // Initialize token usage with default values
  let tokenUsage: TokenUsageWithModel = {
    promptCacheMissTokens: 0,
    promptCacheHitTokens: 0,
    reasoningTokens: 0,
    completionTokens: 0,
    totalOutputTokens: 0,
    totalInputTokens: 0,
    promptCacheWriteTokens: 0,
    model: undefined,
  }

  // Look through all events for usage information and model
  for (const event of events) {
    try {
      const lines = event.split('\n')
      const dataLine = lines.find((line) => line.startsWith('data: '))

      if (dataLine) {
        const jsonStr = dataLine.replace('data: ', '')
        if (jsonStr === '[DONE]') continue

        try {
          const data = JSON.parse(jsonStr)

          // Extract model if available
          if (data.model && !tokenUsage.model) {
            tokenUsage.model = data.model
          }

          // Handle different usage formats
          if (data.message?.usage || data.usage || data.usageMetadata) {
            const eventTokenUsage = extractTokenUsageFromResponseBody(data)

            // Update our running token usage
            tokenUsage.promptCacheMissTokens = Math.max(tokenUsage.promptCacheMissTokens, eventTokenUsage.promptCacheMissTokens)
            tokenUsage.promptCacheHitTokens = Math.max(tokenUsage.promptCacheHitTokens, eventTokenUsage.promptCacheHitTokens)
            tokenUsage.reasoningTokens = Math.max(tokenUsage.reasoningTokens, eventTokenUsage.reasoningTokens)
            tokenUsage.completionTokens = Math.max(tokenUsage.completionTokens, eventTokenUsage.completionTokens)
            tokenUsage.totalOutputTokens = Math.max(tokenUsage.totalOutputTokens, eventTokenUsage.totalOutputTokens)
            tokenUsage.totalInputTokens = Math.max(tokenUsage.totalInputTokens, eventTokenUsage.totalInputTokens)
            tokenUsage.promptCacheWriteTokens = Math.max(tokenUsage.promptCacheWriteTokens, eventTokenUsage.promptCacheWriteTokens)

            // Update model if found
            if (eventTokenUsage.model && !tokenUsage.model) {
              tokenUsage.model = eventTokenUsage.model
            }
          }
        } catch (e) {
          // Skip non-JSON events
          continue
        }
      }
    } catch (error) {
      console.error('Error parsing SSE event:', error)
    }
  }

  // Check if we found any token usage information
  if (tokenUsage.totalInputTokens === 0 && tokenUsage.totalOutputTokens === 0) {
    // We have a model but no token usage - this is likely a streaming response without usage info
    throw new TokenUsageExtractionError('Token usage extraction failed: no token usage information found in streaming response')
  }

  return tokenUsage
}

/**
 * Extract token usage from a response body
 * This function handles both streaming (SSE) and JSON response bodies
 *
 * @param responseBody The raw response body (string for SSE, object for JSON)
 * @returns The extracted token usage with model information when available
 */
export function extractTokenUsageFromResponse(responseBody: string | any): TokenUsageWithModel {
  // Throw error for null or undefined input
  if (responseBody === null || responseBody === undefined) {
    throw new TokenUsageExtractionError('Token usage extraction failed: responseBody is null or undefined')
  }

  try {
    // Check if it's a streaming response (SSE)
    if (isSSEResponseBody(responseBody)) {
      return extractTokenUsageFromStreamingResponseBody(responseBody as string)
    } else {
      // Handle JSON response
      const jsonBody = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody
      return extractTokenUsageFromResponseBody(jsonBody)
    }
  } catch (error) {
    throw new TokenUsageExtractionError(
      `Token usage extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
