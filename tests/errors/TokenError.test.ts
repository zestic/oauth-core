/**
 * Tests for TokenError class
 */

import { TokenError } from '../../src/errors/TokenError';
import { OAuthError } from '../../src/errors/OAuthError';

describe('TokenError', () => {
  describe('Basic functionality', () => {
    it('should create a TokenError with required parameters', () => {
      const error = new TokenError('Token expired', 'TOKEN_EXPIRED');

      expect(error.message).toBe('Token expired');
      expect(error.code).toBe('TOKEN_EXPIRED');
      expect(error.type).toBe('token');
      expect(error.name).toBe('TokenError');
      expect(error).toBeInstanceOf(OAuthError);
      expect(error).toBeInstanceOf(TokenError);
    });

    it('should create a TokenError with metadata', () => {
      const expiresAt = new Date();
      const error = new TokenError('Access token expired', 'ACCESS_TOKEN_EXPIRED', {
        tokenType: 'access',
        expiresAt,
        scopes: ['read', 'write']
      });

      expect(error.getTokenType()).toBe('access');
      expect((error.metadata as any).expiresAt).toBe(expiresAt);
      expect((error.metadata as any).scopes).toEqual(['read', 'write']);
    });
  });

  describe('Error type checking', () => {
    it('should identify expired token errors', () => {
      const expiredError = new TokenError('Expired', 'TOKEN_EXPIRED');
      const accessExpiredError = new TokenError('Expired', 'ACCESS_TOKEN_EXPIRED');
      const refreshExpiredError = new TokenError('Expired', 'REFRESH_TOKEN_EXPIRED');
      const invalidError = new TokenError('Invalid', 'TOKEN_INVALID');

      expect(expiredError.isExpired()).toBe(true);
      expect(accessExpiredError.isExpired()).toBe(true);
      expect(refreshExpiredError.isExpired()).toBe(true);
      expect(invalidError.isExpired()).toBe(false);
    });

    it('should identify invalid token errors', () => {
      const invalidError = new TokenError('Invalid', 'TOKEN_INVALID');
      const accessInvalidError = new TokenError('Invalid', 'ACCESS_TOKEN_INVALID');
      const refreshInvalidError = new TokenError('Invalid', 'REFRESH_TOKEN_INVALID');
      const expiredError = new TokenError('Expired', 'TOKEN_EXPIRED');

      expect(invalidError.isInvalid()).toBe(true);
      expect(accessInvalidError.isInvalid()).toBe(true);
      expect(refreshInvalidError.isInvalid()).toBe(true);
      expect(expiredError.isInvalid()).toBe(false);
    });

    it('should identify missing token errors', () => {
      const missingError = new TokenError('Missing', 'TOKEN_MISSING');
      const accessMissingError = new TokenError('Missing', 'ACCESS_TOKEN_MISSING');
      const refreshMissingError = new TokenError('Missing', 'REFRESH_TOKEN_MISSING');
      const invalidError = new TokenError('Invalid', 'TOKEN_INVALID');

      expect(missingError.isMissing()).toBe(true);
      expect(accessMissingError.isMissing()).toBe(true);
      expect(refreshMissingError.isMissing()).toBe(true);
      expect(invalidError.isMissing()).toBe(false);
    });
  });

  describe('Time until expiration', () => {
    it('should calculate time until expiration', () => {
      const expiresAt = new Date(Date.now() + 60000); // 1 minute from now
      const error = new TokenError('Expired', 'TOKEN_EXPIRED', { expiresAt });

      const timeUntil = error.getTimeUntilExpiration();
      expect(timeUntil).toBeGreaterThan(50000);
      expect(timeUntil).toBeLessThanOrEqual(60000);
    });

    it('should return null when no expiration time is available', () => {
      const error = new TokenError('Expired', 'TOKEN_EXPIRED');
      expect(error.getTimeUntilExpiration()).toBeNull();
    });

    it('should return 0 for already expired tokens', () => {
      const expiresAt = new Date(Date.now() - 60000); // 1 minute ago
      const error = new TokenError('Expired', 'TOKEN_EXPIRED', { expiresAt });

      expect(error.getTimeUntilExpiration()).toBe(0);
    });
  });

  describe('User messages', () => {
    it('should return appropriate messages for different error types', () => {
      const expiredError = new TokenError('Expired', 'TOKEN_EXPIRED');
      const invalidError = new TokenError('Invalid', 'TOKEN_INVALID');
      const missingError = new TokenError('Missing', 'TOKEN_MISSING');
      const refreshFailedError = new TokenError('Failed', 'TOKEN_REFRESH_FAILED');

      expect(expiredError.getUserMessage()).toContain('session has expired');
      expect(invalidError.getUserMessage()).toContain('Invalid authentication token');
      expect(missingError.getUserMessage()).toContain('Authentication required');
      expect(refreshFailedError.getUserMessage()).toContain('Unable to refresh');
    });
  });

  describe('Static factory methods', () => {
    it('should create access token expired error', () => {
      const expiresAt = new Date();
      const scopes = ['read', 'write'];
      const error = TokenError.accessTokenExpired(expiresAt, scopes);

      expect(error.code).toBe('ACCESS_TOKEN_EXPIRED');
      expect(error.getTokenType()).toBe('access');
      expect((error.metadata as any).expiresAt).toBe(expiresAt);
      expect((error.metadata as any).scopes).toBe(scopes);
      expect(error.retryable).toBe(true);
      expect(error.isExpired()).toBe(true);
    });

    it('should create refresh token expired error', () => {
      const expiresAt = new Date();
      const error = TokenError.refreshTokenExpired(expiresAt);

      expect(error.code).toBe('REFRESH_TOKEN_EXPIRED');
      expect(error.getTokenType()).toBe('refresh');
      expect((error.metadata as any).expiresAt).toBe(expiresAt);
      expect(error.retryable).toBe(false);
      expect(error.isExpired()).toBe(true);
    });

    it('should create access token invalid error', () => {
      const tokenHint = '...abc123';
      const error = TokenError.accessTokenInvalid(tokenHint);

      expect(error.code).toBe('ACCESS_TOKEN_INVALID');
      expect(error.getTokenType()).toBe('access');
      expect((error.metadata as any).tokenHint).toBe(tokenHint);
      expect(error.retryable).toBe(true);
      expect(error.isInvalid()).toBe(true);
    });

    it('should create refresh token invalid error', () => {
      const tokenHint = '...def456';
      const error = TokenError.refreshTokenInvalid(tokenHint);

      expect(error.code).toBe('REFRESH_TOKEN_INVALID');
      expect(error.getTokenType()).toBe('refresh');
      expect((error.metadata as any).tokenHint).toBe(tokenHint);
      expect(error.retryable).toBe(false);
      expect(error.isInvalid()).toBe(true);
    });

    it('should create missing token errors', () => {
      const accessMissing = TokenError.accessTokenMissing();
      const refreshMissing = TokenError.refreshTokenMissing();

      expect(accessMissing.code).toBe('ACCESS_TOKEN_MISSING');
      expect(accessMissing.retryable).toBe(true);
      expect(refreshMissing.code).toBe('REFRESH_TOKEN_MISSING');
      expect(refreshMissing.retryable).toBe(false);
    });

    it('should create refresh failed error', () => {
      const originalError = new Error('Network error');
      const error = TokenError.refreshFailed(originalError, 2);

      expect(error.code).toBe('TOKEN_REFRESH_FAILED');
      expect(error.metadata.originalError).toBe(originalError);
      expect(error.metadata.retryCount).toBe(2);
      expect(error.retryable).toBe(true);
    });

    it('should create validation failed error', () => {
      const error = TokenError.validationFailed('Invalid signature', 'access');

      expect(error.code).toBe('TOKEN_VALIDATION_FAILED');
      expect(error.message).toContain('Invalid signature');
      expect(error.getTokenType()).toBe('access');
      expect(error.retryable).toBe(false);
    });

    it('should create insufficient scopes error', () => {
      const requiredScopes = ['admin', 'write'];
      const availableScopes = ['read'];
      const error = TokenError.insufficientScopes(requiredScopes, availableScopes);

      expect(error.code).toBe('TOKEN_INSUFFICIENT_SCOPE');
      expect(error.message).toContain('admin, write');
      expect((error.metadata as any).scopes).toBe(availableScopes);
      expect(error.metadata.context?.requiredScopes).toBe(requiredScopes);
      expect(error.retryable).toBe(false);
    });

    it('should create error from token response', () => {
      const error = TokenError.fromTokenResponse(
        'invalid_grant',
        'The provided authorization grant is invalid',
        'https://example.com/error'
      );

      expect(error.code).toBe('TOKEN_INVALID_GRANT');
      expect(error.message).toBe('The provided authorization grant is invalid');
      expect(error.metadata.context?.oauthError).toBe('invalid_grant');
      expect(error.metadata.context?.errorUri).toBe('https://example.com/error');
    });
  });

  describe('Token hint creation', () => {
    it('should create token hint from full token', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const hint = TokenError.createTokenHint(token);

      expect(hint).toBe('...sw5c');
    });

    it('should handle short tokens', () => {
      const shortToken = 'abc123';
      const hint = TokenError.createTokenHint(shortToken);

      expect(hint).toBe('****');
    });

    it('should handle empty tokens', () => {
      const hint = TokenError.createTokenHint('');
      expect(hint).toBe('****');
    });
  });

  describe('OAuth error code mapping', () => {
    it('should map OAuth error codes correctly', () => {
      const testCases = [
        { oauthError: 'invalid_grant', expectedCode: 'TOKEN_INVALID_GRANT' },
        { oauthError: 'invalid_token', expectedCode: 'TOKEN_INVALID' },
        { oauthError: 'expired_token', expectedCode: 'TOKEN_EXPIRED' },
        { oauthError: 'insufficient_scope', expectedCode: 'TOKEN_INSUFFICIENT_SCOPE' },
        { oauthError: 'invalid_scope', expectedCode: 'TOKEN_INVALID_SCOPE' },
        { oauthError: 'custom_error', expectedCode: 'TOKEN_CUSTOM_ERROR' }
      ];

      testCases.forEach(({ oauthError, expectedCode }) => {
        const error = TokenError.fromTokenResponse(oauthError);
        expect(error.code).toBe(expectedCode);
      });
    });

    it('should set retryable status based on OAuth error type', () => {
      const expiredError = TokenError.fromTokenResponse('expired_token');
      const invalidGrantError = TokenError.fromTokenResponse('invalid_grant');

      expect(expiredError.retryable).toBe(true);
      expect(invalidGrantError.retryable).toBe(false);
    });
  });
});
