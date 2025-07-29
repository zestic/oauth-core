/**
 * Integration tests for GraphQL + OAuth flow
 * Tests the complete flow from GraphQL mutations to OAuth callback handling
 */

import { MagicLinkLoginFlowHandler } from '../../src/flows/MagicLinkLoginFlowHandler';
import { OAuthCore } from '../../src/core/OAuthCore';
import { resolvers, createGraphQLContext } from '../../src/graphql/resolvers';
import type {
  ExtendedOAuthAdapters,
  MagicLinkConfig,
  RegistrationInput,
  SendMagicLinkInput,
  UserRegistrationResult
} from '../../src/types/ServiceTypes';
import type { OAuthConfig } from '../../src/types/OAuthTypes';
import {
  createE2EAdapters,
  createTestOAuthConfig,
  createTestMagicLinkConfig,
  setupCommonMocks
} from './utils/test-adapters';
import { MockHttpAdapter } from '../mocks/adapters';

describe('GraphQL + OAuth Integration', () => {
  let adapters: ExtendedOAuthAdapters;
  let oauthConfig: OAuthConfig;
  let magicLinkConfig: MagicLinkConfig;
  let graphqlContext: any;
  let magicLinkHandler: MagicLinkLoginFlowHandler;
  let oauthCore: OAuthCore;


  beforeEach(() => {
    // Use integration test utilities
    adapters = createE2EAdapters();
    oauthConfig = createTestOAuthConfig();
    magicLinkConfig = createTestMagicLinkConfig();

    // Replace the basic http mock with MockHttpAdapter for better control
    const mockHttpAdapter = new MockHttpAdapter();
    adapters.http = mockHttpAdapter;

    // Setup common mocks (PKCE, state generation)
    setupCommonMocks(adapters);

    // Create GraphQL context and OAuth core
    graphqlContext = createGraphQLContext(adapters, magicLinkConfig);
    magicLinkHandler = new MagicLinkLoginFlowHandler();
    oauthCore = new OAuthCore(oauthConfig, adapters);

    // Register the magic link login flow handler
    oauthCore.registerFlow(magicLinkHandler);

    // Setup HTTP mocks for token exchange
    mockHttpAdapter.mockResponse(oauthConfig.endpoints.token, {
      status: 200,
      data: {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      },
      headers: {}
    });
  });

  describe('Complete Registration + Magic Link Flow', () => {
    it('should handle complete user registration and authentication flow', async () => {
      // Step 1: User registration via GraphQL
      const registrationInput: RegistrationInput = {
        email: 'user@example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'registration-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'registration-state'
      };

      const registrationResult = await resolvers.Mutation.register(
        null,
        { input: registrationInput },
        graphqlContext
      );

      expect(registrationResult).toEqual({
        success: true,
        message: 'User registered successfully',
        code: 'REGISTRATION_SUCCESS'
      });

      // Verify user was registered
      expect(adapters.user.registerUser).toHaveBeenCalledWith(
        'user@example.com',
        { firstName: 'John', lastName: 'Doe' }
      );

      // Verify PKCE data was stored
      expect(await adapters.storage.getItem('pkce_challenge')).toBe('registration-challenge');
      expect(await adapters.storage.getItem('pkce_state')).toBe('registration-state');

      // Step 2: User requests magic link via GraphQL
      const magicLinkInput: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'magic-link-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'magic-link-state'
      };

      // Mock user now exists
      (adapters.user.userExists as jest.Mock).mockResolvedValue(true);

      const magicLinkResult = await resolvers.Mutation.sendMagicLink(
        null,
        { input: magicLinkInput },
        graphqlContext
      );

      expect(magicLinkResult).toEqual({
        success: true,
        message: 'Magic link sent successfully',
        code: 'MAGIC_LINK_SENT'
      });

      // Verify magic link GraphQL mutation was triggered
      expect(adapters.graphql.sendMagicLinkMutation).toHaveBeenCalled();

      // Verify PKCE data was updated for magic link flow
      expect(await adapters.storage.getItem('pkce_challenge')).toBe('magic-link-challenge');
      expect(await adapters.storage.getItem('pkce_state')).toBe('magic-link-state');

      // Step 3: Extract magic link token from GraphQL call
      const graphqlCall = (adapters.graphql.sendMagicLinkMutation as jest.Mock).mock.calls[0];
      const magicLinkUrl = graphqlCall[1];
      const urlParams = new URL(magicLinkUrl).searchParams;
      const magicLinkToken = urlParams.get('magic_link_token');
      const state = urlParams.get('state');

      expect(magicLinkToken).toBeTruthy();
      expect(state).toBe('magic-link-state');

      // Step 4: Simulate user clicking magic link (OAuth callback)
      const callbackParams = new URLSearchParams({
        magic_link_token: magicLinkToken!,
        state: state!,
        flow: 'login'
      });

      // Verify magic link handler can handle the callback
      expect(magicLinkHandler.canHandle(callbackParams, oauthConfig)).toBe(true);

      // Mock token exchange response
      (adapters.http as MockHttpAdapter).mockResponse(oauthConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'access-token-123',
          refresh_token: 'refresh-token-456',
          expires_in: 3600,
          token_type: 'Bearer'
        },
        headers: {}
      });

      // Handle the OAuth callback
      const oauthResult = await magicLinkHandler.handle(callbackParams, adapters, oauthConfig);

      expect(oauthResult).toEqual({
        success: true,
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        expiresIn: 3600
      });

      // Verify tokens were stored
      expect(await adapters.storage.getItem('access_token')).toBe('access-token-123');
      expect(await adapters.storage.getItem('refresh_token')).toBe('refresh-token-456');
    });

    it('should handle magic link flow without prior registration', async () => {
      // Step 1: User requests magic link directly (no registration)
      const magicLinkInput: SendMagicLinkInput = {
        email: 'newuser@example.com',
        codeChallenge: 'direct-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'direct-state'
      };

      // User doesn't exist yet
      (adapters.user.userExists as jest.Mock).mockResolvedValue(false);

      const magicLinkResult = await resolvers.Mutation.sendMagicLink(
        null,
        { input: magicLinkInput },
        graphqlContext
      );

      expect(magicLinkResult.success).toBe(true);

      // Should still trigger magic link GraphQL mutation even if user doesn't exist
      expect(adapters.graphql.sendMagicLinkMutation).toHaveBeenCalled();

      // Step 2: Simulate OAuth callback
      const graphqlCall = (adapters.graphql.sendMagicLinkMutation as jest.Mock).mock.calls[0];
      const magicLinkUrl = graphqlCall[1];
      const urlParams = new URL(magicLinkUrl).searchParams;
      const magicLinkToken = urlParams.get('magic_link_token');

      const callbackParams = new URLSearchParams({
        magic_link_token: magicLinkToken!,
        state: 'direct-state'
      });

      // Mock successful token exchange
      (adapters.http as MockHttpAdapter).mockResponse(oauthConfig.endpoints.token, {
        status: 200,
        data: {
          access_token: 'new-access-token',
          token_type: 'Bearer'
        },
        headers: {}
      });

      const oauthResult = await magicLinkHandler.handle(callbackParams, adapters, oauthConfig);

      expect(oauthResult.success).toBe(true);
      expect(oauthResult.accessToken).toBe('new-access-token');
    });
  });



  describe('Error Scenarios', () => {
    it('should handle registration failure gracefully', async () => {
      (adapters.user.registerUser as jest.Mock).mockResolvedValue({
        success: false,
        message: 'Email already exists'
      } as UserRegistrationResult);

      const registrationInput: RegistrationInput = {
        email: 'existing@example.com',
        additionalData: { firstName: 'Jane' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      const result = await resolvers.Mutation.register(
        null,
        { input: registrationInput },
        graphqlContext
      );

      expect(result).toEqual({
        success: false,
        message: 'Email already exists',
        code: 'REGISTRATION_FAILED'
      });
    });

    it('should handle GraphQL service failure', async () => {
      // Mock GraphQL mutation failure
      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockResolvedValue({
        success: false,
        message: 'SMTP server unavailable'
      });

      const magicLinkInput: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      const result = await resolvers.Mutation.sendMagicLink(
        null,
        { input: magicLinkInput },
        graphqlContext
      );

      // The magic link service should return failure when GraphQL fails
      expect(result.success).toBe(false);
      expect(result.code).toBe('GRAPHQL_MUTATION_FAILED');
    });

    it('should handle OAuth token exchange failure', async () => {
      // Mock token exchange failure
      (adapters.http as MockHttpAdapter).mockResponse(oauthConfig.endpoints.token, {
        status: 400,
        data: { error: 'invalid_grant', error_description: 'Invalid magic link token' },
        headers: {}
      });

      const callbackParams = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'test-state',
        flow: 'login'
      });

      await expect(
        magicLinkHandler.handle(callbackParams, adapters, oauthConfig)
      ).rejects.toThrow();
    });
  });

  describe('Token Refresh Scenarios', () => {
    it('should handle refresh token failure gracefully', async () => {
      // Setup initial tokens
      await adapters.storage.setItem('access_token', 'expired-access-token');
      await adapters.storage.setItem('refresh_token', 'invalid-refresh-token');

      // Set token as expired
      const pastTime = Date.now() - 1000;
      await adapters.storage.setItem('token_expiry', pastTime.toString());

      // Mock refresh token failure response
      (adapters.http as MockHttpAdapter).mockResponse(oauthConfig.endpoints.token, {
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

    it('should automatically refresh tokens during API operations', async () => {
      // Step 1: Setup initial authentication state with expired access token
      await adapters.storage.setItem('access_token', 'expired-access-token');
      await adapters.storage.setItem('refresh_token', 'valid-refresh-token');

      // Set token as expired
      const pastTime = Date.now() - 1000;
      await adapters.storage.setItem('token_expiry', pastTime.toString());

      // Step 2: Mock refresh token exchange for automatic refresh
      (adapters.http as MockHttpAdapter).mockResponse(oauthConfig.endpoints.token, {
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
      (adapters.http as MockHttpAdapter).mockResponse(oauthConfig.endpoints.token, {
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

  describe('State Management', () => {
    it('should properly validate state across GraphQL and OAuth flows', async () => {
      const state = 'secure-state-123';
      
      // Send magic link with specific state
      const magicLinkInput: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state
      };

      await resolvers.Mutation.sendMagicLink(null, { input: magicLinkInput }, graphqlContext);

      // Verify state was stored
      expect(await adapters.storage.getItem('oauth_state')).toBe(state);

      // Simulate callback with correct state
      const callbackParams = new URLSearchParams({
        magic_link_token: 'test-token',
        state
      });

      // Mock successful validation and token exchange
      (adapters.http as MockHttpAdapter).mockResponse(oauthConfig.endpoints.token, {
        status: 200,
        data: { access_token: 'token', token_type: 'Bearer' },
        headers: {}
      });

      const result = await magicLinkHandler.handle(callbackParams, adapters, oauthConfig);
      expect(result.success).toBe(true);
    });

    it('should reject callback with invalid state', async () => {
      // Send magic link with one state
      const magicLinkInput: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'correct-state'
      };

      await resolvers.Mutation.sendMagicLink(null, { input: magicLinkInput }, graphqlContext);

      // Simulate callback with different state
      const callbackParams = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'wrong-state'
      });

      await expect(
        magicLinkHandler.handle(callbackParams, adapters, oauthConfig)
      ).rejects.toThrow();
    });
  });
});
