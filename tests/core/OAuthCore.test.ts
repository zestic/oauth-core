/**
 * Tests for OAuthCore
 */

import { OAuthCore } from '../../src/core/OAuthCore';
import { createMockAdapters, createMockConfig, MockHttpAdapter } from '../mocks/adapters';
import { OAuthError } from '../../src/types/OAuthTypes';

describe('OAuthCore', () => {
  let oauthCore: OAuthCore;
  let mockAdapters: ReturnType<typeof createMockAdapters>;
  let mockConfig: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    mockAdapters = createMockAdapters();
    mockConfig = createMockConfig();
    oauthCore = new OAuthCore(mockConfig, mockAdapters);
  });

  describe('initialization', () => {
    it('should initialize with default flow handlers', () => {
      const flows = oauthCore.getRegisteredFlows();
      expect(flows).toHaveLength(2);
      expect(flows.map(f => f.name)).toContain('authorization_code');
      expect(flows.map(f => f.name)).toContain('magic_link');
    });

    it('should initialize with custom flow configuration', () => {
      const customCore = new OAuthCore(mockConfig, mockAdapters, {
        enabledFlows: ['authorization_code'],
      });

      const flows = customCore.getRegisteredFlows();
      expect(flows).toHaveLength(1);
      expect(flows[0]?.name).toBe('authorization_code');
    });

    it('should throw error if no flows are enabled', () => {
      expect(() => {
        new OAuthCore(mockConfig, mockAdapters, {
          disabledFlows: ['authorization_code', 'magic_link'],
        });
      }).toThrow(OAuthError);
    });
  });

  describe('handleCallback', () => {
    beforeEach(() => {
      // Mock successful token response
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
    });

    it('should handle authorization code flow', async () => {
      // Setup PKCE data in storage
      await mockAdapters.storage.setItem('pkce_code_verifier', 'test-code-verifier');
      // Setup state in storage for validation
      await mockAdapters.storage.setItem('oauth_state', 'test-state');
      await mockAdapters.storage.setItem('oauth_state_expiry', (Date.now() + 60000).toString());

      const params = new URLSearchParams({
        code: 'test-auth-code',
        state: 'test-state',
      });

      const result = await oauthCore.handleCallback(params);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBe('test-refresh-token');
    });

    it('should handle magic link flow', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        flow: 'login',
      });

      const result = await oauthCore.handleCallback(params);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('test-access-token');
    });

    it('should handle string parameters', async () => {
      const paramString = 'token=test-magic-token&flow=login';

      const result = await oauthCore.handleCallback(paramString);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('test-access-token');
    });

    it('should use explicit flow when specified', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
      });

      const result = await oauthCore.handleCallback(params, 'magic_link');

      expect(result.success).toBe(true);
    });

    it('should throw error for unknown explicit flow', async () => {
      const params = new URLSearchParams({
        code: 'test-code',
      });

      await expect(oauthCore.handleCallback(params, 'unknown_flow')).rejects.toThrow(OAuthError);
    });

    it('should throw error when no suitable handler found', async () => {
      const params = new URLSearchParams({
        unsupported: 'parameter',
      });

      await expect(oauthCore.handleCallback(params)).rejects.toThrow(OAuthError);
    });

    it('should handle OAuth errors in parameters', async () => {
      const params = new URLSearchParams({
        error: 'access_denied',
        error_description: 'User denied access',
      });

      await expect(oauthCore.handleCallback(params)).rejects.toThrow(OAuthError);
    });
  });

  describe('PKCE operations', () => {
    it('should generate PKCE challenge', async () => {
      const challenge = await oauthCore.generatePKCEChallenge();

      expect(challenge.codeChallenge).toBe('mock-code-challenge');
      expect(challenge.codeChallengeMethod).toBe('S256');
      expect(challenge.codeVerifier).toBe('mock-code-verifier');
    });

    it('should generate and store state', async () => {
      const state = await oauthCore.generateState();

      expect(state).toBe('mock-state');

      const storedState = await mockAdapters.storage.getItem('oauth_state');
      expect(storedState).toBe('mock-state');
    });
  });

  describe('generateAuthorizationUrl', () => {
    it('should generate complete authorization URL with PKCE parameters', async () => {
      const result = await oauthCore.generateAuthorizationUrl();

      expect(result.state).toBe('mock-state');
      expect(result.url).toContain(mockConfig.endpoints.authorization);
      expect(result.url).toContain(`client_id=${mockConfig.clientId}`);
      expect(result.url).toContain(`redirect_uri=${encodeURIComponent(mockConfig.redirectUri)}`);
      expect(result.url).toContain('scope=read+write'); // URLSearchParams encodes spaces as +
      expect(result.url).toContain(`state=mock-state`);
      expect(result.url).toContain(`code_challenge=mock-code-challenge`);
      expect(result.url).toContain(`code_challenge_method=S256`);
      expect(result.url).toContain('response_type=code');
    });

    it('should include additional parameters in authorization URL', async () => {
      const additionalParams = {
        audience: 'https://api.example.com',
        prompt: 'consent',
        access_type: 'offline',
      };

      const result = await oauthCore.generateAuthorizationUrl(additionalParams);

      expect(result.url).toContain('audience=https%3A%2F%2Fapi.example.com'); // URLSearchParams encodes / as %2F
      expect(result.url).toContain('prompt=consent');
      expect(result.url).toContain('access_type=offline');
    });

    it('should store PKCE parameters and state in storage', async () => {
      await oauthCore.generateAuthorizationUrl();

      // Verify PKCE challenge was stored with correct keys
      const storedVerifier = await mockAdapters.storage.getItem('pkce_code_verifier');
      const storedChallenge = await mockAdapters.storage.getItem('pkce_code_challenge');
      const storedMethod = await mockAdapters.storage.getItem('pkce_code_challenge_method');
      const storedState = await mockAdapters.storage.getItem('oauth_state');

      expect(storedVerifier).toBe('mock-code-verifier');
      expect(storedChallenge).toBe('mock-code-challenge');
      expect(storedMethod).toBe('S256');
      expect(storedState).toBe('mock-state');
    });

    it('should handle empty scopes array', async () => {
      const configWithEmptyScopes = { ...mockConfig, scopes: [] };
      const oauthCoreWithEmptyScopes = new OAuthCore(configWithEmptyScopes, mockAdapters);

      const result = await oauthCoreWithEmptyScopes.generateAuthorizationUrl();

      expect(result.url).toContain('scope=');
      expect(result.url).not.toContain('scope=read%20write');
    });

    it('should handle single scope', async () => {
      const configWithSingleScope = { ...mockConfig, scopes: ['read'] };
      const oauthCoreWithSingleScope = new OAuthCore(configWithSingleScope, mockAdapters);

      const result = await oauthCoreWithSingleScope.generateAuthorizationUrl();

      expect(result.url).toContain('scope=read');
    });

    it('should handle special characters in parameters', async () => {
      const additionalParams = {
        custom_param: 'value with spaces & symbols!',
      };

      const result = await oauthCore.generateAuthorizationUrl(additionalParams);

      expect(result.url).toContain('custom_param=value+with+spaces+%26+symbols%21'); // URLSearchParams encodes spaces as + and ! as %21
    });
  });

  describe('token operations', () => {
    beforeEach(async () => {
      // Store test tokens
      await mockAdapters.storage.setItem('access_token', 'test-access-token');
      await mockAdapters.storage.setItem('refresh_token', 'test-refresh-token');
    });

    it('should get access token', async () => {
      const token = await oauthCore.getAccessToken();
      expect(token).toBe('test-access-token');
    });

    it('should get refresh token', async () => {
      const token = await oauthCore.getRefreshToken();
      expect(token).toBe('test-refresh-token');
    });

    it('should check token expiry', async () => {
      // Token not expired (no expiry set)
      let expired = await oauthCore.isTokenExpired();
      expect(expired).toBe(false);

      // Set expired token
      const pastTime = Date.now() - 1000;
      await mockAdapters.storage.setItem('token_expiry', pastTime.toString());
      
      expired = await oauthCore.isTokenExpired();
      expect(expired).toBe(true);
    });

    it('should refresh access token', async () => {
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

      const result = await oauthCore.refreshAccessToken();

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-access-token');
    });

    it('should throw error when refreshing without refresh token', async () => {
      await mockAdapters.storage.removeItem('refresh_token');

      await expect(oauthCore.refreshAccessToken()).rejects.toThrow(OAuthError);
    });
  });

  describe('logout', () => {
    it('should revoke tokens and clear storage', async () => {
      // Setup tokens
      await mockAdapters.storage.setItem('access_token', 'test-token');
      await mockAdapters.storage.setItem('pkce_code_verifier', 'test-verifier');
      await mockAdapters.storage.setItem('oauth_state', 'test-state');

      // Mock revocation endpoint
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.revocation, {
        status: 200,
        data: {},
        headers: {},
      });

      await oauthCore.logout();

      // Verify tokens are cleared
      expect(await mockAdapters.storage.getItem('access_token')).toBeNull();
      expect(await mockAdapters.storage.getItem('pkce_code_verifier')).toBeNull();
      expect(await mockAdapters.storage.getItem('oauth_state')).toBeNull();
    });
  });

  describe('flow management', () => {
    it('should register custom flow handler', () => {
      const customHandler = {
        name: 'custom_flow',
        priority: 10,
        canHandle: () => true,
        handle: async () => ({ success: true }),
      };

      oauthCore.registerFlow(customHandler);

      const flows = oauthCore.getRegisteredFlows();
      expect(flows.map(f => f.name)).toContain('custom_flow');
    });

    it('should unregister flow handler', () => {
      oauthCore.unregisterFlow('magic_link');

      const flows = oauthCore.getRegisteredFlows();
      expect(flows.map(f => f.name)).not.toContain('magic_link');
    });

    it('should get compatible handlers', () => {
      const params = new URLSearchParams({ code: 'test-code' });
      const handlers = oauthCore.getCompatibleHandlers(params);

      expect(handlers).toHaveLength(1);
      expect(handlers[0]?.name).toBe('authorization_code');
    });
  });
});
