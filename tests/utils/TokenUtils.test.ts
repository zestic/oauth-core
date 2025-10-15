/**
 * Tests for TokenUtils class
 */

import { TokenUtils } from '../../src/token/TokenUtils';
import type { OAuthTokens } from '../../src/events/OAuthEvents';

describe('TokenUtils', () => {
  const mockTokens: OAuthTokens = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresIn: 3600, // 1 hour
    tokenType: 'Bearer',
    scope: 'read write'
  };

  const expiredTokens: OAuthTokens = {
    accessToken: 'expired-token',
    refreshToken: 'expired-refresh',
    expiresIn: -3600, // Already expired 1 hour ago
    tokenType: 'Bearer'
  };

  const noExpirationTokens: OAuthTokens = {
    accessToken: 'no-expiration-token',
    refreshToken: 'no-expiration-refresh',
    tokenType: 'Bearer'
  };

  describe('getExpirationTime', () => {
    it('should calculate expiration time correctly', () => {
      const result = TokenUtils.getExpirationTime(mockTokens);

      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBeGreaterThan(Date.now());
      expect(result!.getTime() - Date.now()).toBeCloseTo(3600000, -3); // Approximately 1 hour
    });

    it('should return null for tokens without expiresIn', () => {
      const result = TokenUtils.getExpirationTime(noExpirationTokens);
      expect(result).toBeNull();
    });

    it('should handle expired tokens', () => {
      const result = TokenUtils.getExpirationTime(expiredTokens);
      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBeLessThan(Date.now());
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid tokens', () => {
      const result = TokenUtils.isTokenExpired(mockTokens);
      expect(result).toBe(false);
    });

    it('should return true for expired tokens', () => {
      const result = TokenUtils.isTokenExpired(expiredTokens);
      expect(result).toBe(true);
    });

    it('should return false for tokens without expiration info', () => {
      const result = TokenUtils.isTokenExpired(noExpirationTokens);
      expect(result).toBe(false);
    });
  });

  describe('getTimeUntilExpiration', () => {
    it('should return positive milliseconds for valid tokens', () => {
      const result = TokenUtils.getTimeUntilExpiration(mockTokens);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(3600000); // Less than or equal to 1 hour
    });

    it('should return negative milliseconds for expired tokens', () => {
      const result = TokenUtils.getTimeUntilExpiration(expiredTokens);
      expect(result).toBeLessThan(0);
    });

    it('should return large positive number for tokens without expiration', () => {
      const result = TokenUtils.getTimeUntilExpiration(noExpirationTokens);
      expect(result).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('shouldRefreshToken', () => {
    it('should return false for fresh tokens with default buffer', () => {
      const result = TokenUtils.shouldRefreshToken(mockTokens);
      expect(result).toBe(false);
    });

    it('should return true for tokens within buffer time', () => {
      // Create tokens that expire in 4 minutes (less than default 5 minute buffer)
      const nearExpiryTokens: OAuthTokens = {
        ...mockTokens,
        expiresIn: 240 // 4 minutes
      };

      const result = TokenUtils.shouldRefreshToken(nearExpiryTokens, 300000); // 5 minute buffer
      expect(result).toBe(true);
    });

    it('should return true for expired tokens', () => {
      const result = TokenUtils.shouldRefreshToken(expiredTokens);
      expect(result).toBe(true);
    });

    it('should return false for tokens without expiration info', () => {
      const result = TokenUtils.shouldRefreshToken(noExpirationTokens);
      expect(result).toBe(false);
    });

    it('should respect custom buffer time', () => {
      // Create tokens that expire in 10 minutes
      const longExpiryTokens: OAuthTokens = {
        ...mockTokens,
        expiresIn: 600 // 10 minutes
      };

      // With 5 minute buffer, should not refresh
      expect(TokenUtils.shouldRefreshToken(longExpiryTokens, 300000)).toBe(false);

      // With 15 minute buffer, should refresh
      expect(TokenUtils.shouldRefreshToken(longExpiryTokens, 900000)).toBe(true);
    });

    it('should handle zero buffer time', () => {
      const result = TokenUtils.shouldRefreshToken(mockTokens, 0);
      expect(result).toBe(false); // Still valid, not within 0 buffer
    });
  });

  describe('edge cases', () => {
    it('should handle tokens with expiresIn of 0', () => {
      const zeroExpiryTokens: OAuthTokens = {
        ...mockTokens,
        expiresIn: 0
      };

      expect(TokenUtils.isTokenExpired(zeroExpiryTokens)).toBe(true);
      expect(TokenUtils.getTimeUntilExpiration(zeroExpiryTokens)).toBeLessThan(0);
      expect(TokenUtils.shouldRefreshToken(zeroExpiryTokens)).toBe(true);
    });

    it('should handle tokens with very large expiresIn', () => {
      const longExpiryTokens: OAuthTokens = {
        ...mockTokens,
        expiresIn: 2147483647 // Max 32-bit signed integer
      };

      expect(TokenUtils.isTokenExpired(longExpiryTokens)).toBe(false);
      expect(TokenUtils.getTimeUntilExpiration(longExpiryTokens)).toBeGreaterThan(0);
      expect(TokenUtils.shouldRefreshToken(longExpiryTokens)).toBe(false);
    });
  });
});