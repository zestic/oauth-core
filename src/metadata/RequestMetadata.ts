/**
 * Request/Response metadata tracking for OAuth operations
 */

import type { OAuthResult } from '../types/OAuthTypes';

export interface RequestMetadata {
  /**
   * Unique identifier for the request
   */
  requestId?: string;

  /**
   * Timestamp when the request was initiated
   */
  timestamp: Date;

  /**
   * Duration of the request in milliseconds
   */
  duration: number;

  /**
   * Number of retry attempts made for this request
   */
  retryCount?: number;

  /**
   * Rate limiting information - remaining requests allowed
   */
  rateLimitRemaining?: number;

  /**
   * Rate limiting information - when the rate limit resets
   */
  rateLimitReset?: Date;
}

export interface OAuthResultWithMetadata extends OAuthResult {
  /**
   * Optional metadata for request/response tracking
   */
  metadata?: RequestMetadata;
}