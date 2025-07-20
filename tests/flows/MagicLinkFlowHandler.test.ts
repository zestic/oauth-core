import { MagicLinkFlowHandler, MagicLinkLoginFlowHandler, MagicLinkRegistrationFlowHandler } from '../../src/flows/MagicLinkFlowHandler';
import { OAuthError } from '../../src/types/OAuthTypes';
import { createMockAdapters, createMockConfig, MockHttpAdapter } from '../mocks/adapters';

describe('MagicLinkFlowHandler', () => {
  let handler: MagicLinkFlowHandler;
  let mockAdapters: ReturnType<typeof createMockAdapters>;
  let mockConfig: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    handler = new MagicLinkFlowHandler();
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

      expect(handler.canHandle(params)).toBe(true);
    });

    it('should handle magic link parameters with magic_link_token', () => {
      const params = new URLSearchParams({
        magic_link_token: 'test-magic-token',
      });

      expect(handler.canHandle(params)).toBe(true);
    });

    it('should not handle authorization code parameters', () => {
      const params = new URLSearchParams({
        code: 'test-auth-code',
      });

      expect(handler.canHandle(params)).toBe(false);
    });

    it('should not handle parameters without token', () => {
      const params = new URLSearchParams({
        state: 'test-state',
      });

      expect(handler.canHandle(params)).toBe(false);
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

    it('should successfully handle magic link flow with magic_link_token parameter', async () => {
      const params = new URLSearchParams({
        magic_link_token: 'test-magic-token',
      });

      const result = await handler.handle(params, mockAdapters, mockConfig);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('test-access-token');
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
        .rejects.toThrow(OAuthError);
    });

    it('should throw error for OAuth error parameters', async () => {
      const params = new URLSearchParams({
        error: 'access_denied',
        error_description: 'User denied access',
      });

      await expect(handler.handle(params, mockAdapters, mockConfig))
        .rejects.toThrow(OAuthError);
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
        .rejects.toThrow(OAuthError);
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
        .rejects.toThrow(OAuthError);
    });
  });

  describe('properties', () => {
    it('should have correct name and priority', () => {
      expect(handler.name).toBe('magic_link');
      expect(handler.priority).toBe(25); // FLOW_PRIORITIES.HIGH
    });
  });
});

describe('MagicLinkLoginFlowHandler', () => {
  let handler: MagicLinkLoginFlowHandler;

  beforeEach(() => {
    handler = new MagicLinkLoginFlowHandler();
  });

  describe('canHandle', () => {
    it('should handle magic link login flow', () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        flow: 'login',
      });

      expect(handler.canHandle(params)).toBe(true);
    });

    it('should not handle magic link registration flow', () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        flow: 'registration',
      });

      expect(handler.canHandle(params)).toBe(false);
    });

    it('should not handle without flow parameter', () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
      });

      expect(handler.canHandle(params)).toBe(false);
    });
  });

  describe('properties', () => {
    it('should have correct name and priority', () => {
      expect(handler.name).toBe('magic_link_login');
      expect(handler.priority).toBe(25); // FLOW_PRIORITIES.HIGH
    });
  });
});

describe('MagicLinkRegistrationFlowHandler', () => {
  let handler: MagicLinkRegistrationFlowHandler;

  beforeEach(() => {
    handler = new MagicLinkRegistrationFlowHandler();
  });

  describe('canHandle', () => {
    it('should handle magic link registration flow', () => {
      const params = new URLSearchParams({
        magic_link_token: 'test-magic-token',
        flow: 'registration',
      });

      expect(handler.canHandle(params)).toBe(true);
    });

    it('should not handle magic link login flow', () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
        flow: 'login',
      });

      expect(handler.canHandle(params)).toBe(false);
    });
  });

  describe('properties', () => {
    it('should have correct name and priority', () => {
      expect(handler.name).toBe('magic_link_registration');
      expect(handler.priority).toBe(25); // FLOW_PRIORITIES.HIGH
    });
  });
});
