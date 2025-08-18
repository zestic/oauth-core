import { BaseMagicLinkFlowHandler } from '../../src/flows/BaseMagicLinkFlowHandler';
import { MagicLinkLoginFlowHandler, createMagicLinkLoginFlowHandler } from '../../src/flows/MagicLinkLoginFlowHandler';
import { MagicLinkVerifyFlowHandler } from '../../src/flows/MagicLinkVerifyFlowHandler';
import { ValidationError, NetworkError } from '../../src/errors';
import { createMockAdapters, createMockConfig, MockHttpAdapter } from '../mocks/adapters';

// Create a concrete implementation for testing the base class
class TestMagicLinkFlowHandler extends BaseMagicLinkFlowHandler {
  readonly name = 'test_magic_link';

  canHandle(params: URLSearchParams, config: any): boolean {
    if (this.isFlowDisabled(config)) {
      return false;
    }
    return this.hasRequiredMagicLinkParams(params);
  }
}

describe('BaseMagicLinkFlowHandler', () => {
  let handler: TestMagicLinkFlowHandler;
  let mockAdapters: ReturnType<typeof createMockAdapters>;
  let mockConfig: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    handler = new TestMagicLinkFlowHandler();
    mockAdapters = createMockAdapters();
    mockConfig = createMockConfig();

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

  describe('canHandle', () => {
    it('should handle magic link parameters with token', () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
      });

      expect(handler.canHandle(params, mockConfig)).toBe(true);
    });



    it('should not handle authorization code parameters', () => {
      const params = new URLSearchParams({
        code: 'test-auth-code',
      });

      expect(handler.canHandle(params, mockConfig)).toBe(false);
    });

    it('should not handle parameters without token', () => {
      const params = new URLSearchParams({
        state: 'test-state',
      });

      expect(handler.canHandle(params, mockConfig)).toBe(false);
    });
  });

  describe('handle', () => {
    it('should successfully handle magic link flow with token parameter', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        state: 'test-state',
      });

      // Mock state validation - need to set both state and expiry
      await mockAdapters.storage.setItem('oauth_state', 'test-state');
      await mockAdapters.storage.setItem('oauth_state_expiry', (Date.now() + 300000).toString()); // 5 minutes from now

      const result = await handler.handle(params, mockAdapters, mockConfig);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBe('test-refresh-token');
      expect(result.expiresIn).toBe(3600);
    });



    it('should handle flow with additional parameters', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        flow: 'login',
        custom_param: 'custom_value',
      });

      const result = await handler.handle(params, mockAdapters, mockConfig);

      expect(result.success).toBe(true);
    });

    it('should throw error for missing token parameter', async () => {
      const params = new URLSearchParams({
        state: 'test-state',
      });

      await expect(handler.handle(params, mockAdapters, mockConfig))
        .rejects.toThrow(ValidationError);
    });

    it('should throw error for OAuth error parameters', async () => {
      const params = new URLSearchParams({
        error: 'access_denied',
        error_description: 'User denied access',
      });

      await expect(handler.handle(params, mockAdapters, mockConfig))
        .rejects.toThrow(ValidationError);
    });

    it('should validate state when present', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        state: 'invalid-state',
      });

      // Mock stored state
      await mockAdapters.storage.setItem('oauth_state', 'valid-state');
      await mockAdapters.storage.setItem('oauth_state_expiry', (Date.now() + 300000).toString());

      await expect(handler.handle(params, mockAdapters, mockConfig))
        .rejects.toThrow(ValidationError);
    });

    it('should handle token exchange failure', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
      });

      // Mock failed token response
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 400,
        data: { error: 'invalid_token' },
        headers: {},
      });

      await expect(handler.handle(params, mockAdapters, mockConfig))
        .rejects.toThrow(NetworkError);
    });

    it('should handle non-OAuth errors during token exchange', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
      });

      // Mock network error
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 500,
        data: 'Internal Server Error',
        headers: {},
      });

      await expect(handler.handle(params, mockAdapters, mockConfig))
        .rejects.toThrow(NetworkError);
    });

    it('should handle state validation when no state stored', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        state: 'some-state',
      });

      // No state stored in storage
      await expect(handler.handle(params, mockAdapters, mockConfig))
        .rejects.toThrow(ValidationError);
    });

    it('should handle expired state', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        state: 'test-state',
      });

      // Mock expired state
      await mockAdapters.storage.setItem('oauth_state', 'test-state');
      await mockAdapters.storage.setItem('oauth_state_expiry', (Date.now() - 1000).toString()); // 1 second ago

      await expect(handler.handle(params, mockAdapters, mockConfig))
        .rejects.toThrow(ValidationError);
    });

    it('should retrieve code_verifier from storage for token exchange', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256',
        state: 'test-state',
      });

      // Store PKCE code_verifier in storage (as it would be during PKCE generation)
      await mockAdapters.storage.setItem('pkce_code_verifier', 'stored-code-verifier');

      // Mock valid state
      await mockAdapters.storage.setItem('oauth_state', 'test-state');
      await mockAdapters.storage.setItem('oauth_state_expiry', (Date.now() + 300000).toString());

      const result = await handler.handle(params, mockAdapters, mockConfig);
      expect(result.success).toBe(true);

      // Verify that the token exchange request included the code_verifier from storage
      const history = (mockAdapters.http as MockHttpAdapter).getRequestHistory();
      expect(history).toHaveLength(1);
      expect(history[0].data).toEqual(expect.objectContaining({
        grant_type: 'magic_link',
        token: 'test-magic-token',
        client_id: mockConfig.clientId,
        code_verifier: 'stored-code-verifier', // Should come from storage, not URL
      }));
    });

    it('should handle flow with PKCE parameters from URL (legacy fallback)', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256',
        code_verifier: 'url-code-verifier', // This is not recommended but should still work
        state: 'test-state',
      });

      // Mock valid state
      await mockAdapters.storage.setItem('oauth_state', 'test-state');
      await mockAdapters.storage.setItem('oauth_state_expiry', (Date.now() + 300000).toString());

      const result = await handler.handle(params, mockAdapters, mockConfig);
      expect(result.success).toBe(true);
    });

    it('should handle flow without state parameter', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
      });

      const result = await handler.handle(params, mockAdapters, mockConfig);
      expect(result.success).toBe(true);
    });

    it('should work when code_verifier is not in storage', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        state: 'test-state',
      });

      // Mock valid state but no PKCE data in storage
      await mockAdapters.storage.setItem('oauth_state', 'test-state');
      await mockAdapters.storage.setItem('oauth_state_expiry', (Date.now() + 300000).toString());

      const result = await handler.handle(params, mockAdapters, mockConfig);
      expect(result.success).toBe(true);

      // Verify that the token exchange request works without code_verifier
      const history = (mockAdapters.http as MockHttpAdapter).getRequestHistory();
      expect(history).toHaveLength(1);
      expect(history[0].data).toEqual(expect.objectContaining({
        grant_type: 'magic_link',
        token: 'test-magic-token',
        client_id: mockConfig.clientId,
      }));
      // Should not include code_verifier
      expect(history[0].data).not.toHaveProperty('code_verifier');
    });
  });

  describe('validate', () => {
    it('should validate parameters with token', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
      });

      const isValid = await handler.validate(params, mockConfig);
      expect(isValid).toBe(true);
    });



    it('should validate parameters with state', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        state: 'test-state',
      });

      const isValid = await handler.validate(params, mockConfig);
      expect(isValid).toBe(true);
    });

    it('should return false for missing token', async () => {
      const params = new URLSearchParams({
        other_param: 'value',
      });

      const isValid = await handler.validate(params, mockConfig);
      expect(isValid).toBe(false);
    });

    it('should return false when OAuth error is present', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        error: 'access_denied',
      });

      const isValid = await handler.validate(params, mockConfig);
      expect(isValid).toBe(false);
    });

    it('should handle validation errors gracefully', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        error: 'invalid_request',
        error_description: 'Invalid request',
      });

      const isValid = await handler.validate(params, mockConfig);
      expect(isValid).toBe(false);
    });
  });

  describe('properties', () => {
    it('should have correct name and priority', () => {
      expect(handler.name).toBe('test_magic_link');
      expect(handler.priority).toBe(25); // FLOW_PRIORITIES.HIGH
    });
  });
});

describe('MagicLinkLoginFlowHandler', () => {
  let handler: MagicLinkLoginFlowHandler;
  let mockAdapters: ReturnType<typeof createMockAdapters>;
  let mockConfig: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    handler = new MagicLinkLoginFlowHandler();
    mockAdapters = createMockAdapters();
    mockConfig = createMockConfig();
  });

  describe('canHandle', () => {
    it('should handle magic link login flow', () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        flow: 'login',
      });

      expect(handler.canHandle(params, mockConfig)).toBe(true);
    });

    it('should not handle magic link registration flow', () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        flow: 'registration',
      });

      expect(handler.canHandle(params, mockConfig)).toBe(false);
    });

    it('should not handle without flow parameter', () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
      });

      expect(handler.canHandle(params, mockConfig)).toBe(false);
    });

    it('should not handle when flow is disabled', () => {
      const configWithDisabledFlows = {
        ...mockConfig,
        flows: {
          disabledFlows: ['magic_link_login']
        }
      };

      const params = new URLSearchParams({
        token: 'test-magic-token',
        flow: 'login',
      });

      expect(handler.canHandle(params, configWithDisabledFlows)).toBe(false);
    });



    it('should not handle without token parameter', () => {
      const params = new URLSearchParams({
        flow: 'login',
      });

      expect(handler.canHandle(params, mockConfig)).toBe(false);
    });
  });

  describe('handle', () => {
    it('should delegate to MagicLinkFlowHandler', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        flow: 'login',
      });

      // Mock successful token exchange
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
        headers: {},
      });

      const result = await handler.handle(params, mockAdapters, mockConfig);
      expect(result.success).toBe(true);
    });
  });

  describe('properties', () => {
    it('should have correct name and priority', () => {
      expect(handler.name).toBe('magic_link_login');
      expect(handler.priority).toBe(25); // FLOW_PRIORITIES.HIGH
    });
  });

  describe('factory function', () => {
    it('should create MagicLinkLoginFlowHandler instance', () => {
      const createdHandler = createMagicLinkLoginFlowHandler();
      expect(createdHandler).toBeInstanceOf(MagicLinkLoginFlowHandler);
      expect(createdHandler.name).toBe('magic_link_login');
    });
  });
});

describe('MagicLinkVerifyFlowHandler', () => {
  let handler: MagicLinkVerifyFlowHandler;
  let mockAdapters: ReturnType<typeof createMockAdapters>;
  let mockConfig: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    handler = new MagicLinkVerifyFlowHandler();
    mockAdapters = createMockAdapters();
    mockConfig = createMockConfig();
  });

  describe('canHandle', () => {
    it('should handle magic link verify flow', () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        flow: 'verify',
      });

      expect(handler.canHandle(params, mockConfig)).toBe(true);
    });





    it('should not handle magic link login flow', () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        flow: 'login',
      });

      expect(handler.canHandle(params, mockConfig)).toBe(false);
    });

    it('should not handle without flow parameter', () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
      });

      expect(handler.canHandle(params, mockConfig)).toBe(false);
    });

    it('should handle token parameter', () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        flow: 'verify',
      });

      expect(handler.canHandle(params, mockConfig)).toBe(true);
    });

    it('should not handle without token parameter', () => {
      const params = new URLSearchParams({
        flow: 'verify',
      });

      expect(handler.canHandle(params, mockConfig)).toBe(false);
    });
  });

  describe('handle', () => {
    it('should handle verify flow', async () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        flow: 'verify',
      });

      // Mock successful token exchange
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
        headers: {},
      });

      const result = await handler.handle(params, mockAdapters, mockConfig);
      expect(result.success).toBe(true);
    });


  });

  describe('properties', () => {
    it('should have correct name and priority', () => {
      expect(handler.name).toBe('magic_link_verify');
      expect(handler.priority).toBe(25); // FLOW_PRIORITIES.HIGH
    });
  });
});
