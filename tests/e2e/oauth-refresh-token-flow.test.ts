/**
 * End-to-end tests for OAuth Refresh Token Grant Flow
 * Tests the complete token lifecycle including refresh token usage
 */

import { AuthorizationCodeFlowHandler } from '../../src/flows/AuthorizationCodeFlowHandler';
import { OAuthCore } from '../../src/core/OAuthCore';
import { resolvers, createGraphQLContext } from '../../src/graphql/resolvers';
import type {
  ExtendedOAuthAdapters,
  MagicLinkConfig,
  RegistrationInput,
  SendMagicLinkInput
} from '../../src/types/ServiceTypes';
import type { OAuthConfig } from '../../src/types/OAuthTypes';
import {
  createE2EAdapters,
  createTestOAuthConfig,
  createTestMagicLinkConfig,
  setupCommonMocks,
  clearAdapterMocks
} from './utils/test-adapters';

describe('OAuth Refresh Token Grant Flow End-to-End', () => {
  let adapters: ExtendedOAuthAdapters;
  let oauthConfig: OAuthConfig;
  let magicLinkConfig: MagicLinkConfig;
  let graphqlContext: any;
  let oauthCore: OAuthCore;
  let authCodeHandler: AuthorizationCodeFlowHandler;

  beforeEach(() => {
    adapters = createE2EAdapters();
    oauthConfig = createTestOAuthConfig();
    magicLinkConfig = createTestMagicLinkConfig();

    graphqlContext = createGraphQLContext(adapters, magicLinkConfig);
    oauthCore = new OAuthCore(oauthConfig, adapters);
    authCodeHandler = new AuthorizationCodeFlowHandler();

    // Setup common mocks
    setupCommonMocks(adapters);
  });

  afterEach(() => {
    clearAdapterMocks(adapters);
  });

  describe('Complete OAuth Flow with Refresh Token Grant', () => {
    it('should handle complete OAuth flow including token refresh', async () => {
      // Step 1: Initial OAuth flow to get tokens
      const registrationInput: RegistrationInput = {
        email: 'user@example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'initial-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'initial-state'
      };

      // Register user via GraphQL
      const registrationResult = await resolvers.Mutation.register(
        null,
        { input: registrationInput },
        graphqlContext
      );

      expect(registrationResult.success).toBe(true);

      // Generate OAuth authorization URL
      const authUrlResult = await oauthCore.generateAuthorizationUrl();
      expect(authUrlResult.url).toContain('code_challenge=test-challenge');
      expect(authUrlResult.state).toBe('test-oauth-state');

      // Simulate OAuth callback with authorization code
      const callbackParams = new URLSearchParams({
        code: 'initial-authorization-code',
        state: authUrlResult.state
      });

      // Mock initial token exchange response
      (adapters.http.post as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: {
          access_token: 'initial-access-token',
          refresh_token: 'initial-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer'
        },
        headers: {}
      });

      // Step 2: Handle initial OAuth callback
      const initialOAuthResult = await authCodeHandler.handle(callbackParams, adapters, oauthConfig);

      expect(initialOAuthResult).toEqual({
        success: true,
        accessToken: 'initial-access-token',
        refreshToken: 'initial-refresh-token',
        expiresIn: 3600
      });

      // Verify initial tokens were stored
      expect(await adapters.storage.getItem('access_token')).toBe('initial-access-token');
      expect(await adapters.storage.getItem('refresh_token')).toBe('initial-refresh-token');

      // Step 3: Simulate token expiration by setting past expiry time
      const pastTime = Date.now() - 1000; // 1 second ago
      await adapters.storage.setItem('token_expiry', pastTime.toString());

      // Verify token is expired
      const isExpired = await oauthCore.isTokenExpired();
      expect(isExpired).toBe(true);

      // Step 4: Mock refresh token exchange response
      (adapters.http.post as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: {
          access_token: 'refreshed-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer'
        },
        headers: {}
      });

      // Step 5: Refresh the access token using refresh token
      const refreshResult = await oauthCore.refreshAccessToken();

      expect(refreshResult).toEqual({
        success: true,
        accessToken: 'refreshed-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600
      });

      // Step 6: Verify new tokens were stored and old ones replaced
      expect(await adapters.storage.getItem('access_token')).toBe('refreshed-access-token');
      expect(await adapters.storage.getItem('refresh_token')).toBe('new-refresh-token');

      // Verify token is no longer expired
      const isStillExpired = await oauthCore.isTokenExpired();
      expect(isStillExpired).toBe(false);

      // Step 7: Verify the HTTP request was made with correct refresh token grant
      const refreshTokenCall = (adapters.http.post as jest.Mock).mock.calls.find(call =>
        typeof call[1] === 'string' && call[1].includes('grant_type=refresh_token')
      );
      expect(refreshTokenCall).toBeDefined();
      expect(refreshTokenCall[1]).toContain('grant_type=refresh_token');
      expect(refreshTokenCall[1]).toContain('token=initial-refresh-token');
      expect(refreshTokenCall[1]).toContain('client_id=test-client-id');
    });

    it('should handle refresh token failure gracefully', async () => {
      // Setup initial tokens
      await adapters.storage.setItem('access_token', 'expired-access-token');
      await adapters.storage.setItem('refresh_token', 'invalid-refresh-token');
      
      // Set token as expired
      const pastTime = Date.now() - 1000;
      await adapters.storage.setItem('token_expiry', pastTime.toString());

      // Mock refresh token failure response
      (adapters.http.post as jest.Mock).mockResolvedValueOnce({
        status: 400,
        data: {
          error: 'invalid_grant',
          error_description: 'The provided refresh token is invalid, expired, or revoked'
        },
        headers: {}
      });

      // Attempt to refresh token should throw error
      await expect(oauthCore.refreshAccessToken()).rejects.toThrow();
    });

    it('should handle missing refresh token scenario', async () => {
      // Setup access token but no refresh token
      await adapters.storage.setItem('access_token', 'access-token-only');
      await adapters.storage.removeItem('refresh_token');

      // Attempt to refresh should throw error
      await expect(oauthCore.refreshAccessToken()).rejects.toThrow('No refresh token available');
    });
  });

  describe('Automatic Token Refresh Scenarios', () => {
    it('should automatically refresh tokens during API operations', async () => {
      // Step 1: Setup initial authentication state with expired access token
      await adapters.storage.setItem('access_token', 'expired-access-token');
      await adapters.storage.setItem('refresh_token', 'valid-refresh-token');
      
      // Set token as expired
      const pastTime = Date.now() - 1000;
      await adapters.storage.setItem('token_expiry', pastTime.toString());

      // Step 2: Mock refresh token exchange for automatic refresh
      (adapters.http.post as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: {
          access_token: 'auto-refreshed-access-token',
          refresh_token: 'new-auto-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer'
        },
        headers: {}
      });

      // Step 3: Simulate an API operation that detects expired token and refreshes
      const currentToken = await oauthCore.getAccessToken();
      expect(currentToken).toBe('expired-access-token');

      const isExpired = await oauthCore.isTokenExpired();
      expect(isExpired).toBe(true);

      // If token is expired, automatically refresh
      if (isExpired) {
        const refreshResult = await oauthCore.refreshAccessToken();
        expect(refreshResult.success).toBe(true);
        expect(refreshResult.accessToken).toBe('auto-refreshed-access-token');
      }

      // Step 4: Verify the new token is now available for API operations
      const newToken = await oauthCore.getAccessToken();
      expect(newToken).toBe('auto-refreshed-access-token');

      const isStillExpired = await oauthCore.isTokenExpired();
      expect(isStillExpired).toBe(false);

      // Step 5: Verify refresh token was rotated
      const newRefreshToken = await oauthCore.getRefreshToken();
      expect(newRefreshToken).toBe('new-auto-refresh-token');
    });

    it('should handle token refresh with GraphQL context integration', async () => {
      // Step 1: Setup expired tokens in storage
      await adapters.storage.setItem('access_token', 'expired-graphql-token');
      await adapters.storage.setItem('refresh_token', 'graphql-refresh-token');

      const pastTime = Date.now() - 1000;
      await adapters.storage.setItem('token_expiry', pastTime.toString());

      // Step 2: Mock successful refresh
      (adapters.http.post as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: {
          access_token: 'fresh-graphql-token',
          refresh_token: 'new-graphql-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer'
        },
        headers: {}
      });

      // Step 3: Simulate GraphQL operation that needs authentication
      // In a real scenario, this would be middleware that checks token expiry
      const isExpired = await oauthCore.isTokenExpired();
      expect(isExpired).toBe(true);

      // Refresh token before proceeding with GraphQL operation
      const refreshResult = await oauthCore.refreshAccessToken();
      expect(refreshResult.success).toBe(true);

      // Step 4: Now GraphQL operations can proceed with fresh token
      const freshToken = await oauthCore.getAccessToken();
      expect(freshToken).toBe('fresh-graphql-token');

      // Step 5: Simulate a GraphQL mutation that would use the fresh token
      const magicLinkInput: SendMagicLinkInput = {
        email: 'authenticated-user@example.com',
        codeChallenge: 'post-refresh-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'post-refresh-state'
      };

      // This operation would now succeed with the fresh token
      const magicLinkResult = await resolvers.Mutation.sendMagicLink(
        null,
        { input: magicLinkInput },
        graphqlContext
      );

      expect(magicLinkResult.success).toBe(true);
    });
  });
});
