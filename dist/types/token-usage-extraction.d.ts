import { TokenUsage } from "./token-cost-calculations";
/**
 * Custom error class for token usage extraction failures
 * This allows the calling code to specifically identify token usage extraction errors
 * and handle them appropriately (e.g., not retry them)
 */
export declare class TokenUsageExtractionError extends Error {
    constructor(message: string);
}
/**
 * Extended TokenUsage interface that includes model information
 */
export interface TokenUsageWithModel extends TokenUsage {
    model?: string;
}
/**
 * Extract token usage from a response body object
 * This is the core function that handles all the different formats of token usage data
 */
export declare function extractTokenUsageFromResponseBody(responseBody: any): TokenUsageWithModel;
/**
 * Determines if the response body is likely a SSE stream based on its content
 */
export declare function isSSEResponseBody(responseBody: string | object): boolean;
/**
 * Extract token usage from a streaming response by parsing SSE events
 */
export declare function extractTokenUsageFromStreamingResponseBody(responseText: string): TokenUsageWithModel;
/**
 * Extract token usage from a response body
 * This function handles both streaming (SSE) and JSON response bodies
 *
 * @param responseBody The raw response body (string for SSE, object for JSON)
 * @returns The extracted token usage with model information when available
 */
export declare function extractTokenUsageFromResponse(responseBody: string | any): TokenUsageWithModel;
