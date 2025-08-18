/**
 * Token-related OAuth errors
 * Handles token expiration, invalid tokens, refresh failures, and token validation
 */

import { OAuthError, OAuthErrorMetadata } from './OAuthError';

export interface TokenErrorMetadata extends OAuthErrorMetadata {
  tokenType?: 'access' | 'refresh' | 'id';
  expiresAt?: Date;
  issuedAt?: Date;
  scopes?: string[];
  audience?: string;
  issuer?: string;
  tokenHint?: string; // Partial token for debugging (last 4 chars)
}

/**
 * Token error class for token-related failures
 */
export class TokenError extends OAuthError {
  constructor(
    message: string,
    code: string,
    metadata: TokenErrorMetadata = {},
    retryable: boolean = false
  ) {
    super(message, code, 'token', retryable, undefined, metadata);
    this.name = 'TokenError';
    Object.setPrototypeOf(this, TokenError.prototype);
  }

  /**
   * Get the token type that caused the error
   */
  getTokenType(): string | undefined {
    return (this.metadata as TokenErrorMetadata).tokenType;
  }

  /**
   * Check if this is an expiration error
   */
  isExpired(): boolean {
    return this.code === 'TOKEN_EXPIRED' || 
           this.code === 'ACCESS_TOKEN_EXPIRED' ||
           this.code === 'REFRESH_TOKEN_EXPIRED';
  }

  /**
   * Check if this is an invalid token error
   */
  isInvalid(): boolean {
    return this.code === 'TOKEN_INVALID' ||
           this.code === 'ACCESS_TOKEN_INVALID' ||
           this.code === 'REFRESH_TOKEN_INVALID' ||
           this.code === 'INVALID_TOKEN';
  }

  /**
   * Check if this is a missing token error
   */
  isMissing(): boolean {
    return this.code === 'TOKEN_MISSING' ||
           this.code === 'ACCESS_TOKEN_MISSING' ||
           this.code === 'REFRESH_TOKEN_MISSING';
  }

  /**
   * Get time until token expiration (if available)
   */
  getTimeUntilExpiration(): number | null {
    const expiresAt = (this.metadata as TokenErrorMetadata).expiresAt;
    if (!expiresAt) {
      return null;
    }
    return Math.max(0, expiresAt.getTime() - Date.now());
  }

  /**
   * Get user-friendly message based on error type
   */
  getUserMessage(): string {
    if (this.isExpired()) {
      return 'Your session has expired. Please log in again.';
    }

    if (this.isInvalid()) {
      return 'Invalid authentication token. Please log in again.';
    }

    if (this.isMissing()) {
      return 'Authentication required. Please log in.';
    }

    if (this.code === 'TOKEN_REFRESH_FAILED') {
      return 'Unable to refresh your session. Please log in again.';
    }

    return super.getUserMessage();
  }

  /**
   * Create a TokenError for expired access token
   */
  static accessTokenExpired(expiresAt?: Date, scopes?: string[]): TokenError {
    return new TokenError(
      'Access token has expired',
      'ACCESS_TOKEN_EXPIRED',
      {
        tokenType: 'access',
        expiresAt,
        scopes
      },
      true // Retryable with refresh token
    );
  }

  /**
   * Create a TokenError for expired refresh token
   */
  static refreshTokenExpired(expiresAt?: Date): TokenError {
    return new TokenError(
      'Refresh token has expired',
      'REFRESH_TOKEN_EXPIRED',
      {
        tokenType: 'refresh',
        expiresAt
      },
      false // Not retryable, requires re-authentication
    );
  }

  /**
   * Create a TokenError for invalid access token
   */
  static accessTokenInvalid(tokenHint?: string): TokenError {
    return new TokenError(
      'Access token is invalid',
      'ACCESS_TOKEN_INVALID',
      {
        tokenType: 'access',
        tokenHint
      },
      true // Retryable with refresh token
    );
  }

  /**
   * Create a TokenError for invalid refresh token
   */
  static refreshTokenInvalid(tokenHint?: string): TokenError {
    return new TokenError(
      'Refresh token is invalid',
      'REFRESH_TOKEN_INVALID',
      {
        tokenType: 'refresh',
        tokenHint
      },
      false // Not retryable, requires re-authentication
    );
  }

  /**
   * Create a TokenError for missing access token
   */
  static accessTokenMissing(): TokenError {
    return new TokenError(
      'Access token is missing',
      'ACCESS_TOKEN_MISSING',
      {
        tokenType: 'access'
      },
      true // Retryable with refresh token
    );
  }

  /**
   * Create a TokenError for missing refresh token
   */
  static refreshTokenMissing(): TokenError {
    return new TokenError(
      'Refresh token is missing',
      'REFRESH_TOKEN_MISSING',
      {
        tokenType: 'refresh'
      },
      false // Not retryable, requires re-authentication
    );
  }

  /**
   * Create a TokenError for token refresh failure
   */
  static refreshFailed(originalError?: Error, retryCount?: number): TokenError {
    return new TokenError(
      'Failed to refresh access token',
      'TOKEN_REFRESH_FAILED',
      {
        originalError,
        retryCount
      },
      true // Retryable up to a limit
    );
  }

  /**
   * Create a TokenError for token validation failure
   */
  static validationFailed(reason: string, tokenType?: 'access' | 'refresh' | 'id'): TokenError {
    return new TokenError(
      `Token validation failed: ${reason}`,
      'TOKEN_VALIDATION_FAILED',
      {
        tokenType
      },
      false // Validation failures are not retryable
    );
  }

  /**
   * Create a TokenError for insufficient scopes
   */
  static insufficientScopes(requiredScopes: string[], availableScopes?: string[]): TokenError {
    return new TokenError(
      `Insufficient token scopes. Required: ${requiredScopes.join(', ')}`,
      'TOKEN_INSUFFICIENT_SCOPE',
      {
        tokenType: 'access',
        scopes: availableScopes,
        context: {
          requiredScopes,
          availableScopes
        }
      },
      false // Scope issues require re-authentication with proper scopes
    );
  }

  /**
   * Create a TokenError from a token response error
   */
  static fromTokenResponse(
    error: string,
    errorDescription?: string,
    errorUri?: string
  ): TokenError {
    const message = errorDescription || error || 'Token error';
    
    // Map OAuth error codes to our token error codes
    let code = 'TOKEN_ERROR';
    let retryable = false;

    switch (error) {
      case 'invalid_grant':
        code = 'TOKEN_INVALID_GRANT';
        break;
      case 'invalid_token':
        code = 'TOKEN_INVALID';
        break;
      case 'expired_token':
        code = 'TOKEN_EXPIRED';
        retryable = true;
        break;
      case 'insufficient_scope':
        code = 'TOKEN_INSUFFICIENT_SCOPE';
        break;
      case 'invalid_scope':
        code = 'TOKEN_INVALID_SCOPE';
        break;
      default:
        code = `TOKEN_${error.toUpperCase()}`;
    }

    return new TokenError(message, code, {
      context: {
        oauthError: error,
        errorDescription,
        errorUri
      }
    }, retryable);
  }

  /**
   * Create a hint from a token (last 4 characters)
   */
  static createTokenHint(token: string): string {
    if (!token || token.length < 8) {
      return '****';
    }
    return `...${token.slice(-4)}`;
  }
}
