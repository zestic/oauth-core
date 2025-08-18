/**
 * Base OAuth error class with enhanced error information
 * Provides structured error handling with metadata, retry logic, and error categorization
 */

export type OAuthErrorType = 'network' | 'auth' | 'token' | 'config' | 'validation' | 'flow';

export interface OAuthErrorMetadata {
  timestamp?: Date;
  requestId?: string;
  operation?: string;
  retryCount?: number;
  statusCode?: number;
  originalError?: Error;
  context?: Record<string, unknown>;
  rateLimitRemaining?: number;
  rateLimitReset?: Date;
}

/**
 * Enhanced OAuth error class with rich error information
 */
export class OAuthError extends Error {
  public readonly timestamp: Date;
  public readonly isOAuthError = true;

  constructor(
    message: string,
    public readonly code: string,
    public readonly type: OAuthErrorType,
    public readonly retryable: boolean = false,
    public readonly statusCode?: number,
    public readonly metadata: OAuthErrorMetadata = {}
  ) {
    super(message);
    this.name = 'OAuthError';
    this.timestamp = new Date();

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, OAuthError.prototype);

    // Add timestamp to metadata if not provided
    if (!this.metadata.timestamp) {
      this.metadata.timestamp = this.timestamp;
    }

    // Preserve original error stack if available
    if (metadata.originalError?.stack) {
      this.stack = `${this.stack}\nCaused by: ${metadata.originalError.stack}`;
    }
  }

  /**
   * Check if this error is retryable
   */
  canRetry(): boolean {
    return this.retryable;
  }

  /**
   * Get retry delay in milliseconds based on retry count
   */
  getRetryDelay(): number {
    if (!this.retryable) {
      return 0;
    }

    const retryCount = this.metadata.retryCount || 0;
    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    return Math.min(1000 * Math.pow(2, retryCount), 30000);
  }

  /**
   * Create a new error with incremented retry count
   */
  withRetry(retryCount: number): OAuthError {
    return new OAuthError(
      this.message,
      this.code,
      this.type,
      this.retryable,
      this.statusCode,
      {
        ...this.metadata,
        retryCount
      }
    );
  }

  /**
   * Add additional context to the error
   */
  withContext(context: Record<string, unknown>): OAuthError {
    return new OAuthError(
      this.message,
      this.code,
      this.type,
      this.retryable,
      this.statusCode,
      {
        ...this.metadata,
        context: {
          ...this.metadata.context,
          ...context
        }
      }
    );
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      type: this.type,
      retryable: this.retryable,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      metadata: this.metadata,
      stack: this.stack
    };
  }

  /**
   * Get a user-friendly error message
   */
  getUserMessage(): string {
    switch (this.type) {
      case 'network':
        return 'Network connection error. Please check your internet connection and try again.';
      case 'auth':
        return 'Authentication failed. Please try logging in again.';
      case 'token':
        return 'Token error. Please refresh your session.';
      case 'config':
        return 'Configuration error. Please contact support.';
      case 'validation':
        return 'Invalid request. Please check your input and try again.';
      case 'flow':
        return 'Authentication flow error. Please try again.';
      default:
        return 'An error occurred. Please try again.';
    }
  }

  /**
   * Check if error is of a specific type
   */
  isType(type: OAuthErrorType): boolean {
    return this.type === type;
  }

  /**
   * Check if error has a specific code
   */
  hasCode(code: string): boolean {
    return this.code === code;
  }

  /**
   * Static method to check if an error is an OAuthError
   */
  static isOAuthError(error: unknown): error is OAuthError {
    return error instanceof OAuthError || 
           (typeof error === 'object' && error !== null && 'isOAuthError' in error);
  }

  /**
   * Create an OAuthError from a generic Error
   */
  static fromError(
    error: Error,
    code: string,
    type: OAuthErrorType,
    retryable: boolean = false
  ): OAuthError {
    return new OAuthError(
      error.message,
      code,
      type,
      retryable,
      undefined,
      {
        originalError: error
      }
    );
  }
}
