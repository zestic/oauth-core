/**
 * Tests for OAuthCore
 */

import { OAuthCore } from '../../src/core/OAuthCore';
import { createMockAdapters, createMockConfig, MockHttpAdapter } from '../mocks/adapters';
import { FlowError, TokenError, OAuthError } from '../../src/errors';
import { MagicLinkLoginFlowHandler } from '../../src/flows/MagicLinkLoginFlowHandler';
import { MagicLinkVerifyFlowHandler } from '../../src/flows/MagicLinkVerifyFlowHandler';
import { EventEmitter } from '../../src/events/EventEmitter';

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
    it('should initialize with no default flow handlers', () => {
      const flows = oauthCore.getRegisteredFlows();
      expect(flows).toHaveLength(0);
    });

    it('should allow manual registration of flow handlers', () => {
      const loginHandler = new MagicLinkLoginFlowHandler();
      oauthCore.registerFlow(loginHandler);

      const flows = oauthCore.getRegisteredFlows();
      expect(flows).toHaveLength(1);
      expect(flows.map(f => f.name)).toContain('magic_link_login');
    });

    it('should initialize with custom flow configuration', () => {
      const customCore = new OAuthCore(mockConfig, mockAdapters, {
        enabledFlows: ['magic_link_login'],
      });

      // Manually register the flow handler
      const loginHandler = new MagicLinkLoginFlowHandler();
      customCore.registerFlow(loginHandler);

      const flows = customCore.getRegisteredFlows();
      expect(flows).toHaveLength(1);
      expect(flows[0]?.name).toBe('magic_link_login');
    });

    it('should not throw error during initialization even with no flows', () => {
      expect(() => {
        new OAuthCore(mockConfig, mockAdapters, {
          disabledFlows: ['magic_link_login'],
        });
      }).not.toThrow();
    });

    it('should handle disabled flows configuration', () => {
      const customCore = new OAuthCore(mockConfig, mockAdapters, {
        disabledFlows: [],
      });

      // Manually register a flow handler
      const loginHandler = new MagicLinkLoginFlowHandler();
      customCore.registerFlow(loginHandler);

      const flows = customCore.getRegisteredFlows();
      expect(flows).toHaveLength(1);
      expect(flows[0]?.name).toBe('magic_link_login');
    });

    it('should handle empty enabledFlows configuration', () => {
      expect(() => {
        new OAuthCore(mockConfig, mockAdapters, {
          enabledFlows: [],
        });
      }).not.toThrow();
    });

    it('should register custom flows', () => {
      const customHandler = {
        name: 'custom_flow',
        priority: 15,
        canHandle: () => true,
        handle: async () => ({ success: true }),
        validate: async () => true,
      };

      const customCore = new OAuthCore(mockConfig, mockAdapters, {
        customFlows: [customHandler],
      });

      const flows = customCore.getRegisteredFlows();
      expect(flows.map(f => f.name)).toContain('custom_flow');
    });

    it('should handle enabledFlows with custom flows', () => {
      const customHandler = {
        name: 'custom_flow',
        priority: 15,
        canHandle: () => true,
        handle: async () => ({ success: true }),
        validate: async () => true,
      };

      const customCore = new OAuthCore(mockConfig, mockAdapters, {
        customFlows: [customHandler],
        enabledFlows: ['custom_flow'],
      });

      const flows = customCore.getRegisteredFlows();
      expect(flows).toHaveLength(1);
      expect(flows[0]?.name).toBe('custom_flow');
    });
  });

  describe('handleCallback', () => {
    beforeEach(() => {
      // Register flow handlers for callback tests
      const loginHandler = new MagicLinkLoginFlowHandler();
      const verifyHandler = new MagicLinkVerifyFlowHandler();
      oauthCore.registerFlow(loginHandler);
      oauthCore.registerFlow(verifyHandler);

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
        flow: 'login',
      });

      const result = await oauthCore.handleCallback(params, 'magic_link_login');

      expect(result.success).toBe(true);
    });

    it('should throw error for unknown explicit flow', async () => {
      const params = new URLSearchParams({
        code: 'test-code',
      });

      await expect(oauthCore.handleCallback(params, 'unknown_flow')).rejects.toThrow(FlowError);
    });

    it('should throw error when no suitable handler found', async () => {
      const params = new URLSearchParams({
        unsupported: 'parameter',
      });

      await expect(oauthCore.handleCallback(params)).rejects.toThrow(FlowError);
    });

    it('should handle OAuth errors in parameters', async () => {
      const params = new URLSearchParams({
        error: 'access_denied',
        error_description: 'User denied access',
      });

      await expect(oauthCore.handleCallback(params)).rejects.toThrow(FlowError);
    });

    it('should handle flow validation failure', async () => {
      // Create a mock handler that fails validation
      const mockHandler = {
        name: 'failing_flow',
        priority: 10,
        canHandle: () => true,
        validate: async () => false,
        handle: async () => ({ success: true }),
      };

      oauthCore.registerFlow(mockHandler);

      const params = new URLSearchParams({ test: 'value' });

      await expect(oauthCore.handleCallback(params, 'failing_flow')).rejects.toThrow(FlowError);
    });

    it('should handle non-OAuth errors during callback', async () => {
      // Create a mock handler that throws a non-OAuth error
      const mockHandler = {
        name: 'error_flow',
        priority: 10,
        canHandle: () => true,
        validate: async () => true,
        handle: async () => {
          throw new Error('Generic error');
        },
      };

      oauthCore.registerFlow(mockHandler);

      const params = new URLSearchParams({ test: 'value' });

      await expect(oauthCore.handleCallback(params, 'error_flow')).rejects.toThrow(FlowError);
    });

    it('should handle non-Error objects during callback', async () => {
      // Create a mock handler that throws a non-Error object
      const mockHandler = {
        name: 'string_error_flow',
        priority: 10,
        canHandle: () => true,
        validate: async () => true,
        handle: async () => {
          throw 'String error';
        },
      };

      oauthCore.registerFlow(mockHandler);

      const params = new URLSearchParams({ test: 'value' });

      await expect(oauthCore.handleCallback(params, 'string_error_flow')).rejects.toThrow(FlowError);
    });

    it('should handle non-OAuth errors in callback', async () => {
      const params = new URLSearchParams({ code: 'test-code', state: 'test-state' });

      // Mock a non-OAuth error
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 500,
        data: { error: 'server_error' },
        headers: {},
      });

      await expect(oauthCore.handleCallback(params)).rejects.toThrow(FlowError);
    });

    it('should handle string parameters in callback', async () => {
      const paramString = 'token=test-magic-token&flow=login';

      const result = await oauthCore.handleCallback(paramString);
      expect(result.success).toBe(true);
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

    it('should handle errors in generateAuthorizationUrl', async () => {
      // Mock PKCE generation failure
      mockAdapters.pkce.generateCodeChallenge = jest.fn().mockRejectedValue(new Error('PKCE failed'));

      await expect(oauthCore.generateAuthorizationUrl()).rejects.toThrow(OAuthError);
    });

    it('should handle non-Error objects in generateAuthorizationUrl', async () => {
      // Mock PKCE generation failure with non-Error object
      mockAdapters.pkce.generateCodeChallenge = jest.fn().mockRejectedValue('string error');

      await expect(oauthCore.generateAuthorizationUrl()).rejects.toThrow(OAuthError);
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

      await expect(oauthCore.refreshAccessToken()).rejects.toThrow(TokenError);
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
        validate: async () => true,
        handle: async () => ({ success: true }),
      };

      oauthCore.registerFlow(customHandler);

      const flows = oauthCore.getRegisteredFlows();
      expect(flows.map(f => f.name)).toContain('custom_flow');
    });

    it('should unregister flow handler', () => {
      // First register a handler to unregister
      const loginHandler = new MagicLinkLoginFlowHandler();
      oauthCore.registerFlow(loginHandler);

      // Then unregister it
      oauthCore.unregisterFlow('magic_link_login');

      const flows = oauthCore.getRegisteredFlows();
      expect(flows.map(f => f.name)).not.toContain('magic_link_login');
    });

    it('should get compatible handlers', () => {
      // Register a handler first
      const loginHandler = new MagicLinkLoginFlowHandler();
      oauthCore.registerFlow(loginHandler);

      const params = new URLSearchParams({
        token: 'test-magic-token',
        flow: 'login'
      });
      const handlers = oauthCore.getCompatibleHandlers(params);

      expect(handlers).toHaveLength(1);
      expect(handlers[0]?.name).toBe('magic_link_login');
    });
  });

  describe('event management', () => {
    it('should remove event listeners with off method', () => {
      const callback = jest.fn();
      oauthCore.on('authStatusChange', callback);
      oauthCore.off('authStatusChange', callback);

      oauthCore.emit('authStatusChange', 'authenticated');
      expect(callback).not.toHaveBeenCalled();
    });

    it('should emit events', () => {
      const callback = jest.fn();
      oauthCore.on('authStatusChange', callback);

      oauthCore.emit('authStatusChange', 'authenticated');

      expect(callback).toHaveBeenCalledWith('authenticated');
    });
  });

  describe('error recovery', () => {
    it('should identify recoverable errors correctly', () => {
      // Test private method through reflection
      const isRecoverableError = (oauthCore as any).isRecoverableError;

      const networkError = new OAuthError('Network error', 'NETWORK_ERROR', 'network');
      const tokenError = new OAuthError('Token error', 'TOKEN_ERROR', 'token');
      const configError = new OAuthError('Config error', 'CONFIG_ERROR', 'config');
      const regularError = new Error('Regular error');

      expect(isRecoverableError(networkError)).toBe(true);
      expect(isRecoverableError(tokenError)).toBe(true);
      expect(isRecoverableError(configError)).toBe(false);
      expect(isRecoverableError(regularError)).toBe(false);
    });
  });

  describe('OAuthCore coverage improvements', () => {
    it('should cover private initialization methods', () => {
      // Test initializeFlows with null config
      const coreWithNullConfig = new OAuthCore(mockConfig, mockAdapters, null as any);
      expect(coreWithNullConfig.getRegisteredFlows()).toHaveLength(0);

      // Test initializeFlows with empty config
      const coreWithEmptyConfig = new OAuthCore(mockConfig, mockAdapters, {});
      expect(coreWithEmptyConfig.getRegisteredFlows()).toHaveLength(0);
    });

    it('should cover private auth status methods', () => {
      // Test setAuthStatus method through reflection
      const setAuthStatus = (oauthCore as any).setAuthStatus;

      // Test different status transitions
      setAuthStatus.call(oauthCore, 'unauthenticated');
      expect(oauthCore.authenticationStatus).toBe('unauthenticated');

      setAuthStatus.call(oauthCore, 'authenticated');
      expect(oauthCore.authenticationStatus).toBe('authenticated');

      setAuthStatus.call(oauthCore, 'refreshing');
      expect(oauthCore.authenticationStatus).toBe('refreshing');

      setAuthStatus.call(oauthCore, 'error');
      expect(oauthCore.authenticationStatus).toBe('error');
    });

    it('should cover private operation context methods', () => {
      const startOperation = (oauthCore as any).startOperation;
      const endOperation = (oauthCore as any).endOperation;

      const context = startOperation.call(oauthCore, 'test_operation', { metadata: 'test' });
      expect(context.operation).toBe('test_operation');
      expect(context.metadata).toEqual({ metadata: 'test' });

      expect(() => endOperation.call(oauthCore, context, true)).not.toThrow();
    });

    it('should cover private event creation methods', () => {
      const createAuthSuccessData = (oauthCore as any).createAuthSuccessData;
      const createAuthErrorData = (oauthCore as any).createAuthErrorData;

      const mockResult = {
        success: true,
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresIn: 3600,
        metadata: {
          requestId: 'test-id',
          timestamp: new Date(),
          duration: 100,
          retryCount: 0
        }
      };

      const successData = createAuthSuccessData.call(oauthCore, mockResult, 'test_flow');
      expect(successData.success).toBe(true);
      expect(successData.flowName).toBe('test_flow');
      expect(successData.metadata).toEqual(mockResult.metadata);

      const errorData = createAuthErrorData.call(oauthCore, new Error('Test error'), 'test_op', 1);
      expect(errorData.error.message).toBe('Test error');
      expect(errorData.operation).toBe('test_op');
      expect(errorData.retryCount).toBe(1);
    });

    it('should cover error handling in token operations', async () => {
      // Test getTokenExpirationTime with no token data
      const result = await oauthCore.getTokenExpirationTime();
      expect(result).toBeNull();

      // Test getTimeUntilTokenExpiration with no token data
      const timeResult = await oauthCore.getTimeUntilTokenExpiration();
      expect(timeResult).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should cover token scheduler operations', async () => {
      // Test scheduleTokenRefresh with no token data
      const cancelFn = await oauthCore.scheduleTokenRefresh();
      expect(typeof cancelFn).toBe('function');

      // Test isTokenRefreshScheduled
      const isScheduled = oauthCore.isTokenRefreshScheduled();
      expect(typeof isScheduled).toBe('boolean');
    });

    it('should cover loading manager getters', () => {
      expect(oauthCore.isLoading).toBe(false);
      expect(Array.isArray(oauthCore.activeOperationsList)).toBe(true);
    });

    it('should cover operation context getter', () => {
      const context = oauthCore.getOperationContext('nonexistent');
      expect(context).toBeUndefined();
    });

    it('should cover loading statistics getter', () => {
      const stats = oauthCore.getLoadingStatistics();
      expect(stats).toBeDefined();
      expect(typeof stats.activeCount).toBe('number');
      expect(typeof stats.completedCount).toBe('number');
      expect(typeof stats.averageDuration).toBe('number');
      expect(typeof stats.successRate).toBe('number');
    });

    it('should cover event emitter methods', () => {
      // Test listener count
      const count = oauthCore.listenerCount('authStatusChange');
      expect(typeof count).toBe('number');

      // Test has listeners
      const hasListeners = oauthCore.hasListeners('authStatusChange');
      expect(typeof hasListeners).toBe('boolean');

      // Test has listeners for specific event
      const hasSpecific = oauthCore.hasListeners();
      expect(typeof hasSpecific).toBe('boolean');
    });

    it('should cover destroy method', () => {
      expect(() => oauthCore.destroy()).not.toThrow();
    });

    it('should cover config validation warning path', () => {
      // Create a config that will trigger validation warnings
      const invalidConfig = {
        ...mockConfig,
        clientId: '', // Empty client ID should trigger warning
      };

      // Spy on console.warn to verify it's called
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Create OAuthCore with invalid config - should warn but not throw
      new OAuthCore(invalidConfig, mockAdapters);

      // Verify warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('OAuthCore: Configuration validation failed'),
        expect.any(Array)
      );

      // Cleanup
      consoleWarnSpy.mockRestore();
    });

    it('should cover config validation event emission', () => {
      const invalidConfig = {
        ...mockConfig,
        clientId: '',
      };

      // Spy on the eventEmitter emit method to verify config validation event
      const emitSpy = jest.spyOn(EventEmitter.prototype as any, 'emit');

      new OAuthCore(invalidConfig, mockAdapters);

      // The configValidation event should have been emitted during construction
      expect(emitSpy).toHaveBeenCalledWith('configValidation', {
        valid: false,
        errors: expect.any(Array),
        warnings: expect.any(Array)
      });

      emitSpy.mockRestore();
    });

    it('should cover initializeAuthStatus error handling', async () => {
      // Mock getAccessToken to throw an error
      mockAdapters.storage.getItem = jest.fn().mockRejectedValue(new Error('Storage error'));

      // Create a new OAuthCore instance to trigger initializeAuthStatus
      const coreWithStorageError = new OAuthCore(mockConfig, mockAdapters);

      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should have set status to 'error'
      expect(coreWithStorageError.authenticationStatus).toBe('error');
    });

    it('should cover console.log statements in handleCallback', async () => {
      // Register flow handlers
      const loginHandler = new MagicLinkLoginFlowHandler();
      oauthCore.registerFlow(loginHandler);

      // Mock token response
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_in: 3600,
          token_type: 'Bearer',
        },
        headers: {},
      });

      // Spy on console.log
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const params = new URLSearchParams({ token: 'test-token', flow: 'login' });
      await oauthCore.handleCallback(params);

      // Verify console.log was called for the expected messages
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[OAuthCore] Handling callback'),
        expect.any(Object)
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[OAuthCore] Using flow handler: magic_link_login')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[OAuthCore] Flow magic_link_login completed'),
        expect.any(Object)
      );

      consoleLogSpy.mockRestore();
    });

    it('should cover console.error in handleCallback catch block', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Create a handler that throws an error
      const errorHandler = {
        name: 'error_handler',
        priority: 10,
        canHandle: () => true,
        validate: async () => true,
        handle: async () => {
          throw new Error('Handler error');
        },
      };

      oauthCore.registerFlow(errorHandler);

      const params = new URLSearchParams({ test: 'value' });

      try {
        await oauthCore.handleCallback(params, 'error_handler');
      } catch (error) {
        // Expected to throw
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[OAuthCore] Callback handling failed'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should cover console.log in generateAuthorizationUrl', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await oauthCore.generateAuthorizationUrl();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[OAuthCore] Generated authorization URL')
      );

      consoleLogSpy.mockRestore();
    });

    it('should cover console.error in generateAuthorizationUrl catch block', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock PKCE to fail
      mockAdapters.pkce.generateCodeChallenge = jest.fn().mockRejectedValue(new Error('PKCE error'));

      try {
        await oauthCore.generateAuthorizationUrl();
      } catch (error) {
        // Expected to throw
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[OAuthCore] Failed to generate authorization URL'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should cover scheduleTokenRefresh console.warn for no token data', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Clear any existing tokens
      await mockAdapters.storage.removeItem('oauth_tokens');

      const cancelFn = await oauthCore.scheduleTokenRefresh();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('scheduleTokenRefresh: No token data available')
      );

      expect(typeof cancelFn).toBe('function');

      consoleWarnSpy.mockRestore();
    });

    it('should cover scheduleTokenRefresh error handling', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Mock storage.getTokenData to throw
      mockAdapters.storage.getTokenData = jest.fn().mockRejectedValue(new Error('Storage error'));

      const cancelFn = await oauthCore.scheduleTokenRefresh();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('scheduleTokenRefresh: Failed to schedule refresh'),
        expect.any(Error)
      );

      expect(typeof cancelFn).toBe('function');

      consoleWarnSpy.mockRestore();
    });

    it('should cover scheduleTokenRefresh success path console output', async () => {
      // Setup - use a fresh OAuthCore instance to avoid state pollution
      const testOAuthCore = new OAuthCore(mockConfig, mockAdapters);

      // Setup token data
      const tokenData = {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresIn: 3600,
        tokenType: 'Bearer',
        issuedAt: new Date(Date.now() - 1000),
      };
      await mockAdapters.storage.setTokenData('oauth_tokens', tokenData);
      await mockAdapters.storage.setItem('refresh_token', 'test-refresh');

      // Mock HTTP response for token refresh
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'new-token',
          refresh_token: 'new-refresh',
          expires_in: 3600,
          token_type: 'Bearer',
        },
        headers: {},
      });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Mock the scheduler to trigger the refresh callback immediately
      const mockScheduler = testOAuthCore['tokenScheduler'] as any;
      const originalScheduleRefresh = mockScheduler.scheduleRefresh;
      mockScheduler.scheduleRefresh = jest.fn().mockImplementation(
        async (_tokens: any, _bufferMs: number, callback: () => Promise<void>) => {
          // Immediately call the callback to test the console.log
          await callback();
          return () => {};
        }
      );

      try {
        // Execute the test
        await testOAuthCore.scheduleTokenRefresh();

        // Check that the refresh callback was executed (which logs the message)
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('TokenScheduler: Executing scheduled refresh')
        );
      } finally {
        // Cleanup - restore mocks and cleanup resources
        consoleLogSpy.mockRestore();
        mockScheduler.scheduleRefresh = originalScheduleRefresh;
        testOAuthCore.destroy();
        (mockAdapters.storage as any).clear();
      }
    });

    it('should cover refreshAccessToken auto-schedule console.warn', async () => {
      // Setup tokens
      await mockAdapters.storage.setItem('refresh_token', 'test-refresh');

      // Mock successful token response
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'new-token',
          refresh_token: 'new-refresh',
          expires_in: 3600,
          token_type: 'Bearer',
        },
        headers: {},
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Mock scheduleTokenRefresh to throw
      oauthCore.scheduleTokenRefresh = jest.fn().mockRejectedValue(new Error('Schedule failed'));

      await oauthCore.refreshAccessToken();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to schedule token refresh after successful refresh'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    it('should cover logout console.warn for revocation failure', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Setup tokens first - need both access_token and refresh_token in individual storage keys
      await mockAdapters.storage.setItem('access_token', 'test-token');
      await mockAdapters.storage.setItem('refresh_token', 'test-refresh');

      // Mock the httpAdapter.post to throw an error directly
      const mockHttpPost = jest.spyOn(mockAdapters.http, 'post').mockRejectedValue(new Error('Revocation failed'));

      await oauthCore.logout();

      // The warning comes from TokenManager.revokeTokens, not OAuthCore.logout
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Token revocation failed:',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
      mockHttpPost.mockRestore();
    });

    it('should cover initializeFlows console.log', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Create new OAuthCore to trigger initializeFlows
      new OAuthCore(mockConfig, mockAdapters);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[OAuthCore] Initialized')
      );

      consoleLogSpy.mockRestore();
    });

    it('should cover initializeFlows flow filtering logic', () => {
      const handler1 = new MagicLinkLoginFlowHandler();
      const handler2 = new MagicLinkVerifyFlowHandler();

      const flowConfig = {
        customFlows: [handler1, handler2],
        enabledFlows: ['magic_link_login'], // Only enable the first one
      };

      const coreWithFilteredFlows = new OAuthCore(mockConfig, mockAdapters, flowConfig);

      const registeredFlows = coreWithFilteredFlows.getRegisteredFlows();

      // Should only have the enabled flow
      expect(registeredFlows.length).toBe(1);
      expect(registeredFlows[0]?.name).toBe('magic_link_login');
    });
  });
});
