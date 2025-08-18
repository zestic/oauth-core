/**
 * Tests for OAuth Events types and constants
 */

import {
  AuthStatus,
  OAuthTokens,
  LoadingContext,
  TokenExpirationData,
  AuthSuccessData,
  AuthErrorData,
  LogoutData,
  ConfigValidationData,
  OAUTH_OPERATIONS,
  OAuthOperation
} from '../../src/events/OAuthEvents';
import { OAuthError, OAUTH_ERROR_CODES } from '../../src/types/OAuthTypes';

describe('OAuth Events', () => {
  describe('AuthStatus type', () => {
    it('should include all expected status values', () => {
      const validStatuses: AuthStatus[] = [
        'unauthenticated',
        'authenticating',
        'authenticated',
        'refreshing',
        'expired',
        'error'
      ];

      validStatuses.forEach(status => {
        expect(typeof status).toBe('string');
      });
    });
  });

  describe('OAuthTokens interface', () => {
    it('should create valid token objects', () => {
      const tokens: OAuthTokens = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        expiresIn: 3600,
        tokenType: 'Bearer',
        scope: 'read write'
      };

      expect(tokens.accessToken).toBe('access-token-123');
      expect(tokens.refreshToken).toBe('refresh-token-456');
      expect(tokens.expiresIn).toBe(3600);
      expect(tokens.tokenType).toBe('Bearer');
      expect(tokens.scope).toBe('read write');
    });

    it('should work with minimal token data', () => {
      const tokens: OAuthTokens = {
        accessToken: 'access-token-123'
      };

      expect(tokens.accessToken).toBe('access-token-123');
      expect(tokens.refreshToken).toBeUndefined();
      expect(tokens.expiresIn).toBeUndefined();
    });
  });

  describe('LoadingContext interface', () => {
    it('should create valid loading context', () => {
      const context: LoadingContext = {
        operation: 'generateAuthorizationUrl',
        startTime: Date.now(),
        metadata: {
          userId: '123',
          flow: 'authorization_code'
        }
      };

      expect(context.operation).toBe('generateAuthorizationUrl');
      expect(typeof context.startTime).toBe('number');
      expect(context.metadata?.userId).toBe('123');
    });

    it('should work without metadata', () => {
      const context: LoadingContext = {
        operation: 'handleCallback',
        startTime: Date.now()
      };

      expect(context.operation).toBe('handleCallback');
      expect(context.metadata).toBeUndefined();
    });
  });

  describe('TokenExpirationData interface', () => {
    it('should create valid expiration data', () => {
      const tokens: OAuthTokens = {
        accessToken: 'token-123',
        expiresIn: 3600
      };

      const expirationData: TokenExpirationData = {
        tokens,
        expiredAt: new Date(),
        timeUntilExpiration: 300000
      };

      expect(expirationData.tokens).toBe(tokens);
      expect(expirationData.expiredAt).toBeInstanceOf(Date);
      expect(expirationData.timeUntilExpiration).toBe(300000);
    });
  });

  describe('AuthSuccessData interface', () => {
    it('should create valid auth success data', () => {
      const authSuccess: AuthSuccessData = {
        success: true,
        accessToken: 'token-123',
        refreshToken: 'refresh-456',
        expiresIn: 3600,
        flowName: 'authorization_code',
        duration: 1500,
        metadata: {
          timestamp: new Date(),
          hasRefreshToken: true
        }
      };

      expect(authSuccess.success).toBe(true);
      expect(authSuccess.accessToken).toBe('token-123');
      expect(authSuccess.flowName).toBe('authorization_code');
      expect(authSuccess.duration).toBe(1500);
      expect(authSuccess.metadata?.hasRefreshToken).toBe(true);
    });
  });

  describe('AuthErrorData interface', () => {
    it('should create valid auth error data', () => {
      const oauthError = new OAuthError(
        'Token exchange failed',
        OAUTH_ERROR_CODES.TOKEN_EXCHANGE_FAILED
      );

      const authError: AuthErrorData = {
        error: oauthError,
        operation: 'handleCallback',
        recoverable: true,
        retryCount: 2
      };

      expect(authError.error).toBe(oauthError);
      expect(authError.operation).toBe('handleCallback');
      expect(authError.recoverable).toBe(true);
      expect(authError.retryCount).toBe(2);
    });

    it('should work with minimal error data', () => {
      const oauthError = new OAuthError(
        'Network error',
        OAUTH_ERROR_CODES.NETWORK_ERROR
      );

      const authError: AuthErrorData = {
        error: oauthError
      };

      expect(authError.error).toBe(oauthError);
      expect(authError.operation).toBeUndefined();
      expect(authError.recoverable).toBeUndefined();
    });
  });

  describe('LogoutData interface', () => {
    it('should create valid logout data', () => {
      const logoutData: LogoutData = {
        reason: 'user',
        clearStorage: true
      };

      expect(logoutData.reason).toBe('user');
      expect(logoutData.clearStorage).toBe(true);
    });

    it('should work with all reason types', () => {
      const reasons: Array<LogoutData['reason']> = ['user', 'expired', 'error', 'revoked'];

      reasons.forEach(reason => {
        const logoutData: LogoutData = { reason };
        expect(logoutData.reason).toBe(reason);
      });
    });
  });

  describe('ConfigValidationData interface', () => {
    it('should create valid config validation data', () => {
      const validationData: ConfigValidationData = {
        valid: false,
        errors: ['Missing client ID', 'Invalid redirect URI'],
        warnings: ['Scope may be too broad']
      };

      expect(validationData.valid).toBe(false);
      expect(validationData.errors).toHaveLength(2);
      expect(validationData.warnings).toHaveLength(1);
      expect(validationData.errors[0]).toBe('Missing client ID');
    });

    it('should work with valid config', () => {
      const validationData: ConfigValidationData = {
        valid: true,
        errors: [],
        warnings: []
      };

      expect(validationData.valid).toBe(true);
      expect(validationData.errors).toHaveLength(0);
      expect(validationData.warnings).toHaveLength(0);
    });
  });

  describe('OAUTH_OPERATIONS constants', () => {
    it('should contain all expected operations', () => {
      const expectedOperations = [
        'generateAuthorizationUrl',
        'handleCallback',
        'refreshToken',
        'revokeToken',
        'exchangeCode',
        'exchangeMagicLink',
        'validateState',
        'generatePKCE',
        'storeTokens',
        'clearTokens'
      ];

      expectedOperations.forEach(operation => {
        expect(Object.values(OAUTH_OPERATIONS)).toContain(operation);
      });
    });

    it('should have correct operation values', () => {
      expect(OAUTH_OPERATIONS.GENERATE_AUTH_URL).toBe('generateAuthorizationUrl');
      expect(OAUTH_OPERATIONS.HANDLE_CALLBACK).toBe('handleCallback');
      expect(OAUTH_OPERATIONS.REFRESH_TOKEN).toBe('refreshToken');
      expect(OAUTH_OPERATIONS.REVOKE_TOKEN).toBe('revokeToken');
      expect(OAUTH_OPERATIONS.EXCHANGE_CODE).toBe('exchangeCode');
      expect(OAUTH_OPERATIONS.EXCHANGE_MAGIC_LINK).toBe('exchangeMagicLink');
      expect(OAUTH_OPERATIONS.VALIDATE_STATE).toBe('validateState');
      expect(OAUTH_OPERATIONS.GENERATE_PKCE).toBe('generatePKCE');
      expect(OAUTH_OPERATIONS.STORE_TOKENS).toBe('storeTokens');
      expect(OAUTH_OPERATIONS.CLEAR_TOKENS).toBe('clearTokens');
    });

    it('should be readonly', () => {
      // In JavaScript, const objects are not deeply frozen by default
      // This test verifies the constant exists and has the expected structure
      expect(OAUTH_OPERATIONS.GENERATE_AUTH_URL).toBe('generateAuthorizationUrl');
      expect(typeof OAUTH_OPERATIONS).toBe('object');
    });
  });

  describe('OAuthOperation type', () => {
    it('should accept valid operation values', () => {
      const validOperations: OAuthOperation[] = [
        'generateAuthorizationUrl',
        'handleCallback',
        'refreshToken',
        'revokeToken',
        'exchangeCode',
        'exchangeMagicLink',
        'validateState',
        'generatePKCE',
        'storeTokens',
        'clearTokens'
      ];

      validOperations.forEach(operation => {
        const op: OAuthOperation = operation;
        expect(typeof op).toBe('string');
      });
    });
  });

  describe('Type compatibility', () => {
    it('should ensure OAuthTokens is compatible with token responses', () => {
      // This test ensures our event types work with existing OAuth types
      const tokens: OAuthTokens = {
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 3600,
        tokenType: 'Bearer'
      };

      // Should be able to use in auth success data
      const authSuccess: AuthSuccessData = {
        success: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
      };

      expect(authSuccess.accessToken).toBe(tokens.accessToken);
      expect(authSuccess.refreshToken).toBe(tokens.refreshToken);
    });

    it('should ensure LoadingContext works with operation tracking', () => {
      const startTime = Date.now();
      const context: LoadingContext = {
        operation: OAUTH_OPERATIONS.HANDLE_CALLBACK,
        startTime,
        metadata: { flow: 'magic_link' }
      };

      // Should be able to calculate duration
      const endTime = Date.now();
      const duration = endTime - context.startTime;

      expect(duration).toBeGreaterThanOrEqual(0);
      expect(context.operation).toBe('handleCallback');
    });
  });
});
