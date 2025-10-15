/**
 * Token utility functions for expiration calculations and validation
 * Provides pure functions for token lifecycle management
 */

import type { OAuthTokens } from '../events/OAuthEvents';

/**
 * Utility class for OAuth token expiration and validation operations
 */
export class TokenUtils {
  /**
   * Calculate the expiration time of tokens
   * @param tokens OAuth tokens object
   * @returns Date when tokens expire, or null if expiration cannot be determined
   */
  static getExpirationTime(tokens: OAuthTokens): Date | null {
    if (tokens.expiresIn === undefined || tokens.expiresIn === null) {
      return null;
    }

    // Use issuedAt if available, otherwise assume current time
    // Note: This is a limitation - we should store issuedAt time in the future
    const issuedAt = Date.now();

    return new Date(issuedAt + (tokens.expiresIn * 1000));
  }

  /**
   * Check if tokens are currently expired
   * @param tokens OAuth tokens object
   * @returns true if tokens are expired, false otherwise
   */
  static isTokenExpired(tokens: OAuthTokens): boolean {
    const expirationTime = this.getExpirationTime(tokens);

    if (!expirationTime) {
      // If we can't determine expiration, assume not expired
      return false;
    }

    // Handle edge case of expiresIn = 0 (already expired when issued)
    if (tokens.expiresIn === 0) {
      return true;
    }

    return Date.now() >= expirationTime.getTime();
  }

  /**
   * Get milliseconds until token expiration
   * @param tokens OAuth tokens object
   * @returns milliseconds until expiration (negative if already expired)
   */
  static getTimeUntilExpiration(tokens: OAuthTokens): number {
    const expirationTime = this.getExpirationTime(tokens);

    if (!expirationTime) {
      // If we can't determine expiration, return large positive number
      return Number.MAX_SAFE_INTEGER;
    }

    // Handle edge case of expiresIn = 0 (already expired when issued)
    if (tokens.expiresIn === 0) {
      return -1; // Return -1 to indicate already expired
    }

    return expirationTime.getTime() - Date.now();
  }

  /**
   * Determine if tokens should be refreshed based on expiration and buffer time
   * @param tokens OAuth tokens object
   * @param bufferMs Buffer time in milliseconds before expiration to trigger refresh (default: 5 minutes)
   * @returns true if tokens should be refreshed, false otherwise
   */
  static shouldRefreshToken(tokens: OAuthTokens, bufferMs: number = 300000): boolean {
    const timeUntilExpiration = this.getTimeUntilExpiration(tokens);

    // Refresh if expiration time cannot be determined (assume refresh needed)
    if (timeUntilExpiration === Number.MAX_SAFE_INTEGER) {
      return false; // Don't refresh if we can't determine expiration
    }

    // Refresh if expired or within buffer time
    return timeUntilExpiration <= bufferMs;
  }
}