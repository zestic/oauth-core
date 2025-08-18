/**
 * Network-related OAuth errors
 * Handles HTTP errors, connection failures, timeouts, and rate limiting
 */

import { OAuthError, OAuthErrorMetadata } from './OAuthError';

export interface NetworkErrorMetadata extends OAuthErrorMetadata {
  url?: string;
  method?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  timeout?: number;
  connectionError?: boolean;
}

/**
 * Network error class for HTTP and connection-related failures
 */
export class NetworkError extends OAuthError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    metadata: NetworkErrorMetadata = {}
  ) {
    super(
      message,
      NetworkError.getErrorCode(statusCode),
      'network',
      NetworkError.isRetryable(statusCode),
      statusCode,
      metadata
    );
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }

  /**
   * Get appropriate error code based on status code
   */
  private static getErrorCode(statusCode?: number): string {
    if (!statusCode) {
      return 'NETWORK_CONNECTION_ERROR';
    }

    if (statusCode >= 500) {
      return 'NETWORK_SERVER_ERROR';
    }

    if (statusCode === 429) {
      return 'NETWORK_RATE_LIMITED';
    }

    if (statusCode === 408 || statusCode === 504) {
      return 'NETWORK_TIMEOUT';
    }

    if (statusCode >= 400) {
      return 'NETWORK_CLIENT_ERROR';
    }

    return 'NETWORK_ERROR';
  }

  /**
   * Determine if error is retryable based on status code
   */
  private static isRetryable(statusCode?: number): boolean {
    if (!statusCode) {
      return true; // Connection errors are retryable
    }

    // Server errors and rate limiting are retryable
    if (statusCode >= 500 || statusCode === 429 || statusCode === 408 || statusCode === 504) {
      return true;
    }

    // Client errors are generally not retryable
    return false;
  }

  /**
   * Get retry delay with rate limit consideration
   */
  getRetryDelay(): number {
    // If we have rate limit reset time, use that
    if (this.metadata.rateLimitReset) {
      const resetTime = this.metadata.rateLimitReset.getTime();
      const now = Date.now();
      const delay = Math.max(0, resetTime - now);
      
      // Cap at 5 minutes for rate limit delays
      return Math.min(delay, 5 * 60 * 1000);
    }

    // For 429 errors without reset time, use longer delay
    if (this.statusCode === 429) {
      const retryCount = this.metadata.retryCount || 0;
      return Math.min(5000 * Math.pow(2, retryCount), 60000); // 5s, 10s, 20s, 40s, max 60s
    }

    // Use default exponential backoff for other retryable errors
    return super.getRetryDelay();
  }

  /**
   * Check if this is a timeout error
   */
  isTimeout(): boolean {
    return this.statusCode === 408 || 
           this.statusCode === 504 || 
           this.code === 'NETWORK_TIMEOUT';
  }

  /**
   * Check if this is a rate limit error
   */
  isRateLimited(): boolean {
    return this.statusCode === 429 || this.code === 'NETWORK_RATE_LIMITED';
  }

  /**
   * Check if this is a server error
   */
  isServerError(): boolean {
    return (this.statusCode && this.statusCode >= 500) || 
           this.code === 'NETWORK_SERVER_ERROR';
  }

  /**
   * Check if this is a connection error
   */
  isConnectionError(): boolean {
    return !this.statusCode || 
           (this.metadata as NetworkErrorMetadata).connectionError === true;
  }

  /**
   * Get user-friendly message based on error type
   */
  getUserMessage(): string {
    if (this.isRateLimited()) {
      return 'Too many requests. Please wait a moment and try again.';
    }

    if (this.isTimeout()) {
      return 'Request timed out. Please check your connection and try again.';
    }

    if (this.isServerError()) {
      return 'Server error. Please try again in a few moments.';
    }

    if (this.isConnectionError()) {
      return 'Unable to connect. Please check your internet connection.';
    }

    return super.getUserMessage();
  }

  /**
   * Create a NetworkError from an HTTP response
   */
  static fromHttpResponse(
    statusCode: number,
    responseBody: any,
    url?: string,
    method?: string,
    requestHeaders?: Record<string, string>,
    responseHeaders?: Record<string, string>
  ): NetworkError {
    let message = `HTTP ${statusCode}`;
    
    // Try to extract error message from response
    if (responseBody && typeof responseBody === 'object') {
      if (responseBody.error_description) {
        message += `: ${responseBody.error_description}`;
      } else if (responseBody.error) {
        message += `: ${responseBody.error}`;
      } else if (responseBody.message) {
        message += `: ${responseBody.message}`;
      }
    }

    return new NetworkError(message, statusCode, {
      url,
      method,
      requestHeaders,
      responseHeaders,
      responseBody,
      rateLimitRemaining: responseHeaders?.['x-ratelimit-remaining'] ? 
        parseInt(responseHeaders['x-ratelimit-remaining']) : undefined,
      rateLimitReset: responseHeaders?.['x-ratelimit-reset'] ? 
        new Date(parseInt(responseHeaders['x-ratelimit-reset']) * 1000) : undefined
    });
  }

  /**
   * Create a NetworkError from a connection error
   */
  static fromConnectionError(error: Error, url?: string, method?: string): NetworkError {
    return new NetworkError(
      `Connection failed: ${error.message}`,
      undefined,
      {
        url,
        method,
        connectionError: true,
        originalError: error
      }
    );
  }

  /**
   * Create a NetworkError from a timeout
   */
  static fromTimeout(timeout: number, url?: string, method?: string): NetworkError {
    return new NetworkError(
      `Request timed out after ${timeout}ms`,
      408,
      {
        url,
        method,
        timeout
      }
    );
  }
}
