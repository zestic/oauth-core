/**
 * Tests for AuthorizationCodeFlowHandler
 */

import { AuthorizationCodeFlowHandler } from '../../src/flows/AuthorizationCodeFlowHandler';
import { createMockAdapters, createMockConfig, MockHttpAdapter } from '../mocks/adapters';
import { OAuthError } from '../../src/types/OAuthTypes';

describe('AuthorizationCodeFlowHandler', () => {
  let handler: AuthorizationCodeFlowHandler;
  let mockAdapters: ReturnType<typeof createMockAdapters>;
  let mockConfig: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    handler = new AuthorizationCodeFlowHandler();
    mockAdapters = createMockAdapters();
    mockConfig = createMockConfig();
  });

  describe('canHandle', () => {
    it('should handle authorization code flow parameters', () => {
      const params = new URLSearchParams({
        code: 'test-auth-code',
        state: 'test-state',
      });

      expect(handler.canHandle(params)).toBe(true);
    });

    it('should not handle magic link parameters', () => {
      const params = new URLSearchParams({
        token: 'test-magic-token',
      });

      expect(handler.canHandle(params)).toBe(false);
    });

    it('should not handle parameters with both code and token', () => {
      const params = new URLSearchParams({
        code: 'test-auth-code',
        token: 'test-magic-token',
      });

      expect(handler.canHandle(params)).toBe(false);
    });

    it('should not handle parameters without code', () => {
      const params = new URLSearchParams({
        state: 'test-state',
      });

      expect(handler.canHandle(params)).toBe(false);
    });
  });

  describe('validate', () => {
    beforeEach(async () => {
      // Setup valid state in storage
      await mockAdapters.storage.setItem('oauth_state', 'test-state');
      await mockAdapters.storage.setItem('oauth_state_expiry', (Date.now() + 60000).toString());
    });

    it('should validate correct parameters', async () => {
      const params = new URLSearchParams({
        code: 'test-auth-code',
        state: 'test-state',
      });

      const isValid = await handler.validate!(params);
      expect(isValid).toBe(true);
    });

    it('should reject parameters with OAuth error', async () => {
      const params = new URLSearchParams({
        error: 'access_denied',
        error_description: 'User denied access',
      });

      const isValid = await handler.validate!(params);
      expect(isValid).toBe(false);
    });

    it('should reject parameters without required code', async () => {
      const params = new URLSearchParams({
        state: 'test-state',
      });

      const isValid = await handler.validate!(params);
      expect(isValid).toBe(false);
    });

    it('should accept parameters with state (basic validation)', async () => {
      const params = new URLSearchParams({
        code: 'test-auth-code',
        state: 'invalid-state',
      });

      // The validate method only does basic parameter validation
      // State validation happens in the handle method
      const isValid = await handler.validate!(params);
      expect(isValid).toBe(true);
    });

    it('should validate parameters without state', async () => {
      const params = new URLSearchParams({
        code: 'test-auth-code',
      });

      const isValid = await handler.validate!(params);
      expect(isValid).toBe(true);
    });
  });

  describe('handle', () => {
    beforeEach(async () => {
      // Setup PKCE data
      await mockAdapters.storage.setItem('pkce_code_verifier', 'test-code-verifier');
      await mockAdapters.storage.setItem('oauth_state', 'test-state');
      await mockAdapters.storage.setItem('oauth_state_expiry', (Date.now() + 60000).toString());

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

    it('should successfully handle authorization code flow', async () => {
      const params = new URLSearchParams({
        code: 'test-auth-code',
        state: 'test-state',
      });

      const result = await handler.handle(params, mockAdapters, mockConfig);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBe('test-refresh-token');
      expect(result.expiresIn).toBe(3600);
    });

    it('should handle flow without state parameter', async () => {
      const params = new URLSearchParams({
        code: 'test-auth-code',
      });

      const result = await handler.handle(params, mockAdapters, mockConfig);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('test-access-token');
    });

    it('should throw error for OAuth error parameters', async () => {
      const params = new URLSearchParams({
        error: 'access_denied',
        error_description: 'User denied access',
      });

      await expect(handler.handle(params, mockAdapters, mockConfig)).rejects.toThrow(OAuthError);
    });

    it('should throw error for missing code parameter', async () => {
      const params = new URLSearchParams({
        state: 'test-state',
      });

      await expect(handler.handle(params, mockAdapters, mockConfig)).rejects.toThrow(OAuthError);
    });

    it('should throw error for invalid state', async () => {
      const params = new URLSearchParams({
        code: 'test-auth-code',
        state: 'invalid-state',
      });

      await expect(handler.handle(params, mockAdapters, mockConfig)).rejects.toThrow(OAuthError);
    });

    it('should throw error when PKCE code verifier is missing', async () => {
      await mockAdapters.storage.removeItem('pkce_code_verifier');

      const params = new URLSearchParams({
        code: 'test-auth-code',
      });

      await expect(handler.handle(params, mockAdapters, mockConfig)).rejects.toThrow(OAuthError);
    });

    it('should throw error for token exchange failure', async () => {
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 400,
        data: {
          error: 'invalid_grant',
          error_description: 'Invalid authorization code',
        },
        headers: {},
      });

      const params = new URLSearchParams({
        code: 'invalid-auth-code',
      });

      await expect(handler.handle(params, mockAdapters, mockConfig)).rejects.toThrow(OAuthError);
    });

    it('should clean up PKCE data after successful exchange', async () => {
      const params = new URLSearchParams({
        code: 'test-auth-code',
      });

      await handler.handle(params, mockAdapters, mockConfig);

      // Verify PKCE data is cleared
      expect(await mockAdapters.storage.getItem('pkce_code_verifier')).toBeNull();
    });

    it('should handle non-OAuth errors during token exchange', async () => {
      (mockAdapters.http as MockHttpAdapter).mockResponse(mockConfig.endpoints.token, {
        status: 500,
        data: 'Internal Server Error',
        headers: {},
      });

      const params = new URLSearchParams({
        code: 'test-auth-code',
      });

      await expect(handler.handle(params, mockAdapters, mockConfig)).rejects.toThrow(OAuthError);
    });

    it('should handle state validation when no state stored', async () => {
      await mockAdapters.storage.removeItem('oauth_state');

      const params = new URLSearchParams({
        code: 'test-auth-code',
        state: 'some-state',
      });

      await expect(handler.handle(params, mockAdapters, mockConfig)).rejects.toThrow(OAuthError);
    });

    it('should handle expired state', async () => {
      await mockAdapters.storage.setItem('oauth_state_expiry', (Date.now() - 1000).toString()); // 1 second ago

      const params = new URLSearchParams({
        code: 'test-auth-code',
        state: 'test-state',
      });

      await expect(handler.handle(params, mockAdapters, mockConfig)).rejects.toThrow(OAuthError);
    });
  });

  describe('properties', () => {
    it('should have correct name and priority', () => {
      expect(handler.name).toBe('authorization_code');
      expect(handler.priority).toBe(50); // FLOW_PRIORITIES.NORMAL
    });
  });
});
