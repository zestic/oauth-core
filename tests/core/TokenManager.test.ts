import { TokenManager } from '../../src/core/TokenManager';
import { OAuthError } from '../../src/types/OAuthTypes';
import { createMockAdapters, createMockConfig, MockHttpAdapter } from '../mocks/adapters';

describe('TokenManager', () => {
  let tokenManager: TokenManager;
  let mockAdapters: ReturnType<typeof createMockAdapters>;
  let mockConfig: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    mockAdapters = createMockAdapters();
    mockConfig = createMockConfig();
    tokenManager = new TokenManager(mockAdapters.http, mockAdapters.storage);
  });

  describe('exchangeAuthorizationCode', () => {
    it('should successfully exchange authorization code for tokens', async () => {
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        },
        headers: {},
      });

      const result = await tokenManager.exchangeAuthorizationCode(
        'test-code',
        'test-verifier',
        mockConfig
      );

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBe('test-refresh-token');
      expect(result.expiresIn).toBe(3600);
    });

    it('should handle token exchange failure', async () => {
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 400,
        data: { error: 'invalid_grant' },
        headers: {},
      });

      await expect(
        tokenManager.exchangeAuthorizationCode('invalid-code', 'test-verifier', mockConfig)
      ).rejects.toThrow(OAuthError);
    });

    it('should handle network errors', async () => {
      // Mock a network error by not setting up any response
      await expect(
        tokenManager.exchangeAuthorizationCode('test-code', 'test-verifier', mockConfig)
      ).rejects.toThrow();
    });
  });

  describe('exchangeMagicLinkToken', () => {
    it('should successfully exchange magic link token', async () => {
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'magic-access-token',
          refresh_token: 'magic-refresh-token',
          expires_in: 7200,
          token_type: 'Bearer',
        },
        headers: {},
      });

      const result = await tokenManager.exchangeMagicLinkToken(
        'magic-token',
        mockConfig,
        { flow: 'login' }
      );

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('magic-access-token');
      expect(result.refreshToken).toBe('magic-refresh-token');
      expect(result.expiresIn).toBe(7200);
    });

    it('should handle magic link token exchange failure', async () => {
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 400,
        data: { error: 'invalid_token' },
        headers: {},
      });

      await expect(
        tokenManager.exchangeMagicLinkToken('invalid-token', mockConfig)
      ).rejects.toThrow(OAuthError);
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh access token', async () => {
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        },
        headers: {},
      });

      const result = await tokenManager.refreshToken('test-refresh-token', mockConfig);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should handle refresh token failure', async () => {
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 400,
        data: { error: 'invalid_grant' },
        headers: {},
      });

      await expect(
        tokenManager.refreshToken('invalid-refresh-token', mockConfig)
      ).rejects.toThrow(OAuthError);
    });
  });

  describe('buildTokenRequestBody', () => {
    it('should build request body with all parameters', async () => {
      // We need to test this indirectly through token exchange
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'test-token',
          token_type: 'Bearer',
        },
        headers: {},
      });

      await tokenManager.exchangeAuthorizationCode('code', 'verifier', mockConfig);

      // Verify the request was made with correct data
      const history = (mockAdapters.http as MockHttpAdapter).getRequestHistory();
      expect(history).toHaveLength(1);
      expect(history[0].data).toEqual(expect.objectContaining({
        grant_type: 'authorization_code',
        code: 'code',
        code_verifier: 'verifier',
        client_id: mockConfig.clientId,
        redirect_uri: mockConfig.redirectUri,
      }));
    });

    it('should build request body for refresh token', async () => {
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'new-token',
          token_type: 'Bearer',
        },
        headers: {},
      });

      await tokenManager.refreshToken('test-refresh', mockConfig);

      const history = (mockAdapters.http as MockHttpAdapter).getRequestHistory();
      expect(history).toHaveLength(1);
      expect(history[0].data).toEqual(expect.objectContaining({
        grant_type: 'refresh_token',
        refresh_token: 'test-refresh',
        client_id: mockConfig.clientId,
      }));
    });

    it('should build request body for magic link token', async () => {
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'magic-token',
          token_type: 'Bearer',
        },
        headers: {},
      });

      await tokenManager.exchangeMagicLinkToken('magic-token', mockConfig);

      const history = (mockAdapters.http as MockHttpAdapter).getRequestHistory();
      expect(history).toHaveLength(1);
      expect(history[0].data).toEqual(expect.objectContaining({
        grant_type: 'magic_link',
        token: 'magic-token',
        client_id: mockConfig.clientId,
      }));
    });
  });

  describe('storeTokens', () => {
    it('should store all token information', async () => {
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'stored-access-token',
          refresh_token: 'stored-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        },
        headers: {},
      });

      await tokenManager.exchangeAuthorizationCode('code', 'verifier', mockConfig);

      expect(await mockAdapters.storage.getItem('access_token')).toBe('stored-access-token');
      expect(await mockAdapters.storage.getItem('refresh_token')).toBe('stored-refresh-token');
      expect(await mockAdapters.storage.getItem('token_type')).toBe('Bearer');
      
      const expiry = await mockAdapters.storage.getItem('token_expiry');
      expect(expiry).toBeTruthy();
    });

    it('should handle storage errors', async () => {
      mockAdapters.storage.setItem = jest.fn().mockRejectedValue(new Error('Storage failed'));

      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'test-token',
          token_type: 'Bearer',
        },
        headers: {},
      });

      await expect(
        tokenManager.exchangeAuthorizationCode('code', 'verifier', mockConfig)
      ).rejects.toThrow(OAuthError);
    });

    it('should handle non-Error objects in storage errors', async () => {
      mockAdapters.storage.setItem = jest.fn().mockRejectedValue('storage error string');

      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'test-token',
          token_type: 'Bearer',
        },
        headers: {},
      });

      await expect(
        tokenManager.exchangeAuthorizationCode('code', 'verifier', mockConfig)
      ).rejects.toThrow(OAuthError);
    });
  });

  describe('getAccessToken', () => {
    it('should retrieve stored access token', async () => {
      await mockAdapters.storage.setItem('access_token', 'stored-token');

      const token = await tokenManager.getAccessToken();
      expect(token).toBe('stored-token');
    });

    it('should return null when no token stored', async () => {
      const token = await tokenManager.getAccessToken();
      expect(token).toBeNull();
    });
  });

  describe('getRefreshToken', () => {
    it('should retrieve stored refresh token', async () => {
      await mockAdapters.storage.setItem('refresh_token', 'stored-refresh');

      const token = await tokenManager.getRefreshToken();
      expect(token).toBe('stored-refresh');
    });

    it('should return null when no refresh token stored', async () => {
      const token = await tokenManager.getRefreshToken();
      expect(token).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false when no expiry set', async () => {
      const expired = await tokenManager.isTokenExpired();
      expect(expired).toBe(false);
    });

    it('should return false when token not expired', async () => {
      const futureTime = Date.now() + 3600000; // 1 hour from now
      await mockAdapters.storage.setItem('token_expiry', futureTime.toString());

      const expired = await tokenManager.isTokenExpired();
      expect(expired).toBe(false);
    });

    it('should return true when token expired', async () => {
      const pastTime = Date.now() - 1000; // 1 second ago
      await mockAdapters.storage.setItem('token_expiry', pastTime.toString());

      const expired = await tokenManager.isTokenExpired();
      expect(expired).toBe(true);
    });
  });

  describe('clearTokens', () => {
    it('should clear all stored tokens', async () => {
      // Store some tokens first
      await mockAdapters.storage.setItem('access_token', 'test-access');
      await mockAdapters.storage.setItem('refresh_token', 'test-refresh');
      await mockAdapters.storage.setItem('token_expiry', '123456789');
      await mockAdapters.storage.setItem('token_type', 'Bearer');

      await tokenManager.clearTokens();

      expect(await mockAdapters.storage.getItem('access_token')).toBeNull();
      expect(await mockAdapters.storage.getItem('refresh_token')).toBeNull();
      expect(await mockAdapters.storage.getItem('token_expiry')).toBeNull();
      expect(await mockAdapters.storage.getItem('token_type')).toBeNull();
    });
  });

  describe('revokeTokens', () => {
    it('should revoke tokens and clear storage', async () => {
      await mockAdapters.storage.setItem('access_token', 'test-access');
      await mockAdapters.storage.setItem('refresh_token', 'test-refresh');

      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.revocation, {
        status: 200,
        data: {},
        headers: {},
      });

      await tokenManager.revokeTokens(mockConfig);

      expect(await mockAdapters.storage.getItem('access_token')).toBeNull();
      expect(await mockAdapters.storage.getItem('refresh_token')).toBeNull();
    });

    it('should handle revocation failure gracefully', async () => {
      await mockAdapters.storage.setItem('access_token', 'test-access');

      // Don't set up a mock response to simulate failure
      // Should not throw, but should still clear tokens
      await tokenManager.revokeTokens(mockConfig);

      expect(await mockAdapters.storage.getItem('access_token')).toBeNull();
    });

    it('should handle revocation with no tokens', async () => {
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.revocation, {
        status: 200,
        data: {},
        headers: {},
      });

      // Should not throw when no tokens to revoke
      await expect(tokenManager.revokeTokens(mockConfig)).resolves.not.toThrow();
    });
  });

  describe('error handling edge cases', () => {
    it('should handle missing token response data', async () => {
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: null,
        headers: {},
      });

      await expect(
        tokenManager.exchangeAuthorizationCode('code', 'verifier', mockConfig)
      ).rejects.toThrow(OAuthError);
    });

    it('should handle storage retrieval errors', async () => {
      mockAdapters.storage.getItem = jest.fn().mockRejectedValue(new Error('Storage read failed'));

      // These methods don't wrap storage errors in OAuthError, they let them bubble up
      await expect(tokenManager.getAccessToken()).rejects.toThrow('Storage read failed');
    });

    it('should handle token expiry check errors', async () => {
      mockAdapters.storage.getItem = jest.fn().mockRejectedValue(new Error('Storage failed'));

      // This method doesn't wrap storage errors in OAuthError
      await expect(tokenManager.isTokenExpired()).rejects.toThrow('Storage failed');
    });

    it('should handle clear tokens errors', async () => {
      mockAdapters.storage.removeItems = jest.fn().mockRejectedValue(new Error('Clear failed'));

      // This method doesn't wrap storage errors in OAuthError
      await expect(tokenManager.clearTokens()).rejects.toThrow('Clear failed');
    });
  });

  describe('token response validation', () => {
    it('should handle response without expires_in', async () => {
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          token_type: 'Bearer',
        },
        headers: {},
      });

      const result = await tokenManager.exchangeAuthorizationCode('code', 'verifier', mockConfig);
      expect(result.success).toBe(true);
      expect(result.expiresIn).toBeUndefined();
    });

    it('should handle response without refresh_token', async () => {
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'Bearer',
        },
        headers: {},
      });

      const result = await tokenManager.exchangeAuthorizationCode('code', 'verifier', mockConfig);
      expect(result.success).toBe(true);
      expect(result.refreshToken).toBeUndefined();
    });

    it('should handle response with empty access_token', async () => {
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: '',
          refresh_token: 'test-refresh',
          expires_in: 3600,
          token_type: 'Bearer',
        },
        headers: {},
      });

      // The current implementation doesn't validate empty access_token, it just stores it
      const result = await tokenManager.exchangeAuthorizationCode('code', 'verifier', mockConfig);
      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('');
    });
  });
});
