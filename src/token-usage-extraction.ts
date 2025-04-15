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
 * Extract token usage from a response body object
 * This is the core function that handles all the different formats of token usage data
 */
export function extractTokenUsageFromResponseBody(responseBody: any): TokenUsage {
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
  } else if (responseBody?.usage) {
    // Handle Mistral format
    if (responseBody.model?.startsWith('mistral-')) {
      promptCacheMissTokens = responseBody.usage.promptTokens || 0
      completionTokens = responseBody.usage.completionTokens || 0
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

      // Extract cache hit tokens
      promptCacheHitTokens = responseBody.usage.cache_read_input_tokens || responseBody.usage.cache_read_tokens || 0

      // Extract cache write tokens
      promptCacheWriteTokens = responseBody.usage.cache_creation_input_tokens || responseBody.usage.cache_write_tokens || 0
    }
  } else if (responseBody.usageMetadata) {
    // Handle different usageMetadata formats
    if (responseBody.usageMetadata.promptTokenCount !== undefined && responseBody.usageMetadata.candidatesTokenCount !== undefined) {
      // Gemini 2.0 Flash format
      promptCacheMissTokens = responseBody.usageMetadata.promptTokenCount || 0
      completionTokens = responseBody.usageMetadata.candidatesTokenCount || 0
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
  } else if (responseBody.promptTokenCount) {
    // Google AI Studio format
    promptCacheMissTokens = responseBody.promptTokenCount || 0
    completionTokens = responseBody.candidatesTokenCount || 0
  }

  // Calculate total values
  totalOutputTokens = reasoningTokens + completionTokens
  totalInputTokens = promptCacheMissTokens + promptCacheHitTokens + promptCacheWriteTokens

  return {
    promptCacheMissTokens,
    promptCacheHitTokens,
    reasoningTokens,
    completionTokens,
    totalOutputTokens,
    totalInputTokens,
    promptCacheWriteTokens,
  }
}

/**
 * Extract token usage from a streaming response by parsing SSE events
 */
export async function extractTokenUsageFromStreamingResponse(response: Response): Promise<TokenUsage> {
  // Throw error for null or undefined response
  if (!response) {
    throw new TokenUsageExtractionError('Token usage extraction failed: response is null or undefined')
  }

  // Throw error if response is not a valid Response object
  if (!(response instanceof Response)) {
    throw new TokenUsageExtractionError('Token usage extraction failed: response is not a valid Response object')
  }

  // Throw error if response body is not available
  if (!response.body) {
    throw new TokenUsageExtractionError('Token usage extraction failed: response body is not available')
  }

  // Read the entire stream
  const reader = response.body.getReader()
  if (!reader) {
    throw new TokenUsageExtractionError('Token usage extraction failed: no reader available for streaming response')
  }

  const chunks: string[] = []
  let done = false

  while (!done) {
    const { value, done: doneReading } = await reader.read()
    done = doneReading
    if (value) {
      chunks.push(new TextDecoder().decode(value))
    }
  }

  // Combine all chunks
  const fullText = chunks.join('')

  // Check for error events in the stream
  if (fullText.includes('event: error') || fullText.includes('"type":"error"')) {
    throw new TokenUsageExtractionError('Token usage extraction failed: error event detected in stream')
  }

  // Parse SSE events
  const events = fullText.split('\n\n').filter((event) => event.trim() !== '')

  // Initialize token usage with default values
  let tokenUsage: TokenUsage = {
    promptCacheMissTokens: 0,
    promptCacheHitTokens: 0,
    reasoningTokens: 0,
    completionTokens: 0,
    totalOutputTokens: 0,
    totalInputTokens: 0,
    promptCacheWriteTokens: 0,
  }

  // Look through all events for usage information
  for (const event of events) {
    try {
      const lines = event.split('\n')
      const dataLine = lines.find((line) => line.startsWith('data: '))

      if (dataLine) {
        const jsonStr = dataLine.replace('data: ', '')
        if (jsonStr === '[DONE]') continue

        try {
          const data = JSON.parse(jsonStr)

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

  return tokenUsage
}

/**
 * Extract token usage from a response object
 * This is the top-level function that handles both streaming and non-streaming responses
 */
export async function extractTokenUsageFromResponse(response: Response): Promise<TokenUsage> {
  // Throw error for null or undefined response
  if (!response) {
    throw new TokenUsageExtractionError('Token usage extraction failed: response is null or undefined')
  }

  // Throw error if response is not a valid Response object
  if (!(response instanceof Response)) {
    throw new TokenUsageExtractionError('Token usage extraction failed: response is not a valid Response object')
  }

  // Check if response status is OK
  if (!response.ok) {
    throw new TokenUsageExtractionError(`Token usage extraction failed: response status is ${response.status}`)
  }

  try {
    // Clone the response before using it
    const responseClone = response.clone()

    // Check if the response is a streaming response
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('text/event-stream')) {
      // Handle streaming response
      return await extractTokenUsageFromStreamingResponse(responseClone)
    } else {
      // Handle regular JSON response
      const responseJson = await responseClone.json()
      return extractTokenUsageFromResponseBody(responseJson)
    }
  } catch (error) {
    throw new TokenUsageExtractionError(
      `Token usage extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
