/**
 * Integration tests for GraphQL + OAuth Magic Link Registered Flow
 * Tests the complete registered user authentication flow from GraphQL mutations to OAuth callback handling
 */

import { MagicLinkRegisteredFlowHandler } from '../../src/flows/MagicLinkRegisteredFlowHandler';
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

describe('GraphQL + OAuth Magic Link Registered Flow Integration', () => {
  let adapters: ExtendedOAuthAdapters;
  let oauthConfig: OAuthConfig;
  let magicLinkConfig: MagicLinkConfig;
  let graphqlContext: any;
  let magicLinkHandler: MagicLinkRegisteredFlowHandler;
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

    // Pre-store the test state for validation
    adapters.storage.setItem('oauth_state', 'test-oauth-state');

    // Create GraphQL context and OAuth core
    graphqlContext = createGraphQLContext(adapters, magicLinkConfig);
    magicLinkHandler = new MagicLinkRegisteredFlowHandler();
    oauthCore = new OAuthCore(oauthConfig, adapters);

    // Register the magic link registered flow handler
    oauthCore.registerFlow(magicLinkHandler);

    // Setup HTTP mocks for token exchange (registered flow uses token exchange)
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

  describe('Complete Registration + Registered User Authentication Flow', () => {
    it('should handle complete user registration and registered user authentication flow', async () => {
      // Step 1: User registration via GraphQL
      const registrationInput: RegistrationInput = {
        email: 'user@example.com',
        additionalData: {
          firstName: 'John',
          lastName: 'Doe'
        },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-oauth-state'
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

      // Step 2: Send registered user magic link via GraphQL
      const magicLinkInput: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-oauth-state'
      };

      const magicLinkResult = await resolvers.Mutation.sendMagicLink(
        null,
        { input: magicLinkInput },
        graphqlContext
      );

      expect(magicLinkResult.success).toBe(true);
      expect(magicLinkResult.message).toBeTruthy();

      // Verify GraphQL mutation was called for registered user
      expect(adapters.graphql.sendMagicLinkMutation).toHaveBeenCalledWith(
        'user@example.com',
        expect.stringContaining('flow=magic_link'),
        expect.objectContaining({
          subject: 'Your Magic Link',
          templateData: expect.objectContaining({
            email: 'user@example.com',
            expirationMinutes: 15
          })
        })
      );

      // Step 3: Extract magic link components from the call
      const graphqlCall = (adapters.graphql.sendMagicLinkMutation as jest.Mock).mock.calls[0];
      const magicLinkUrl = graphqlCall[1]; // Second parameter is the URL
      const urlParams = new URL(magicLinkUrl).searchParams;
      const magicLinkToken = urlParams.get('magic_link_token');
      const state = urlParams.get('state');

      expect(magicLinkToken).toBeTruthy();
      expect(state).toBe('test-oauth-state');

      // Step 4: Simulate registered user clicking magic link (OAuth callback)
      const callbackParams = new URLSearchParams({
        magic_link_token: magicLinkToken!,
        state: state!,
        flow: 'registered'
      });

      // Verify magic link handler can handle the registered callback
      expect(magicLinkHandler.canHandle(callbackParams, oauthConfig)).toBe(true);

      // Handle the OAuth registered callback (performs token exchange)
      const registeredResult = await magicLinkHandler.handle(callbackParams, adapters, oauthConfig);

      expect(registeredResult.success).toBe(true);
      expect(registeredResult.error).toBeUndefined();
      expect(registeredResult.accessToken).toBe('test-access-token');
      expect(registeredResult.refreshToken).toBe('test-refresh-token');

      // Verify authentication tokens were stored (registered flow stores tokens)
      expect(await adapters.storage.getItem('access_token')).toBe('test-access-token');
      expect(await adapters.storage.getItem('refresh_token')).toBe('test-refresh-token');
      expect(await adapters.storage.getItem('token_expiry')).toBeTruthy();

      // Verify state was cleared after successful authentication
      expect(await adapters.storage.getItem('oauth_state')).toBeNull();
    });

    it('should handle registered user authentication without prior registration in session', async () => {
      // Step 1: Send registered user magic link directly (user already exists)
      const magicLinkInput: SendMagicLinkInput = {
        email: 'existing@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-oauth-state'
      };

      const magicLinkResult = await resolvers.Mutation.sendMagicLink(
        null,
        { input: magicLinkInput },
        graphqlContext
      );

      expect(magicLinkResult.success).toBe(true);

      // Step 2: Extract registered link components
      const graphqlCall = (adapters.graphql.sendMagicLinkMutation as jest.Mock).mock.calls[0];
      const magicLinkUrl = graphqlCall[1]; // Second parameter is the URL
      const urlParams = new URL(magicLinkUrl).searchParams;
      const magicLinkToken = urlParams.get('magic_link_token');

      // Step 3: Simulate registered callback
      const callbackParams = new URLSearchParams({
        magic_link_token: magicLinkToken!,
        state: 'test-oauth-state',
        flow: 'registered'
      });

      const registeredResult = await magicLinkHandler.handle(callbackParams, adapters, oauthConfig);

      expect(registeredResult.success).toBe(true);
      expect(registeredResult.error).toBeUndefined();
      expect(registeredResult.accessToken).toBe('test-access-token');
      expect(registeredResult.refreshToken).toBe('test-refresh-token');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle registration failure gracefully', async () => {
      // Mock registration failure
      (adapters.user.registerUser as jest.Mock).mockResolvedValue({
        success: false,
        message: 'Email already exists',
        code: 'REGISTRATION_FAILED'
      } as UserRegistrationResult);

      const registrationInput: RegistrationInput = {
        email: 'existing@example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-oauth-state'
      };

      const result = await resolvers.Mutation.register(
        null,
        { input: registrationInput },
        graphqlContext
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe('REGISTRATION_FAILED');
    });

    it('should handle GraphQL service failure', async () => {
      // Mock GraphQL service failure
      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Service temporarily unavailable'
      });

      const magicLinkInput: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-oauth-state'
      };

      const result = await resolvers.Mutation.sendMagicLink(
        null,
        { input: magicLinkInput },
        graphqlContext
      );

      expect(result.success).toBe(false);
    });

    it('should handle token exchange failure', async () => {
      // Mock token exchange failure
      (adapters.http as MockHttpAdapter).mockResponse(oauthConfig.endpoints.token, {
        status: 400,
        data: { error: 'invalid_grant', error_description: 'Invalid magic link token' },
        headers: {}
      });

      const callbackParams = new URLSearchParams({
        magic_link_token: 'invalid-token',
        state: 'test-oauth-state',
        flow: 'registered'
      });

      await expect(
        magicLinkHandler.handle(callbackParams, adapters, oauthConfig)
      ).rejects.toThrow();
    });
  });

  describe('State Management', () => {
    it('should properly validate state across GraphQL and registered flows', async () => {
      // Step 1: Send magic link and capture state
      const magicLinkInput: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-oauth-state'
      };

      await resolvers.Mutation.sendMagicLink(
        null,
        { input: magicLinkInput },
        graphqlContext
      );

      // Extract state from the generated magic link
      const graphqlCall = (adapters.graphql.sendMagicLinkMutation as jest.Mock).mock.calls[0];
      const magicLinkUrl = graphqlCall[1]; // Second parameter is the URL
      const urlParams = new URL(magicLinkUrl).searchParams;
      const state = urlParams.get('state');

      // Step 2: Use the same state in registered callback
      const callbackParams = new URLSearchParams({
        magic_link_token: 'test-token',
        flow: 'registered',
        state: state || 'test-oauth-state'
      });

      const result = await magicLinkHandler.handle(callbackParams, adapters, oauthConfig);
      expect(result.success).toBe(true);
    });

    it('should reject registered callback with invalid state', async () => {
      // Send magic link with one state
      const magicLinkInput: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-oauth-state'
      };

      await resolvers.Mutation.sendMagicLink(
        null,
        { input: magicLinkInput },
        graphqlContext
      );

      // Use different state in callback (CSRF attack simulation)
      const callbackParams = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'wrong-state',
        flow: 'registered'
      });

      await expect(
        magicLinkHandler.handle(callbackParams, adapters, oauthConfig)
      ).rejects.toThrow();
    });
  });

  describe('Registered Flow Characteristics', () => {
    it('should store authentication tokens during registered flow', async () => {
      // First send a magic link to set up proper state
      const magicLinkInput: SendMagicLinkInput = {
        email: 'test@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-oauth-state'
      };

      await resolvers.Mutation.sendMagicLink(
        null,
        { input: magicLinkInput },
        graphqlContext
      );

      // Extract the magic link token from the GraphQL call
      const graphqlCall = (adapters.graphql.sendMagicLinkMutation as jest.Mock).mock.calls[0];
      const magicLinkUrl = graphqlCall[1];
      const urlParams = new URL(magicLinkUrl).searchParams;
      const magicLinkToken = urlParams.get('magic_link_token');

      const callbackParams = new URLSearchParams({
        magic_link_token: magicLinkToken!,
        state: 'test-oauth-state',
        flow: 'registered'
      });

      const result = await magicLinkHandler.handle(callbackParams, adapters, oauthConfig);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify authentication tokens were stored (registered flow stores tokens)
      expect(await adapters.storage.getItem('access_token')).toBe('test-access-token');
      expect(await adapters.storage.getItem('refresh_token')).toBe('test-refresh-token');
      expect(await adapters.storage.getItem('token_expiry')).toBeTruthy();

      // Verify result contains authentication data
      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBe('test-refresh-token');
      expect(result.expiresIn).toBe(3600);
    });

    it('should use token endpoint for registered flow authentication', async () => {
      // First send a magic link to set up proper state
      const magicLinkInput: SendMagicLinkInput = {
        email: 'test@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-oauth-state'
      };

      await resolvers.Mutation.sendMagicLink(
        null,
        { input: magicLinkInput },
        graphqlContext
      );

      // Extract the magic link token from the GraphQL call
      const graphqlCall = (adapters.graphql.sendMagicLinkMutation as jest.Mock).mock.calls[0];
      const magicLinkUrl = graphqlCall[1];
      const urlParams = new URL(magicLinkUrl).searchParams;
      const magicLinkToken = urlParams.get('magic_link_token');

      const callbackParams = new URLSearchParams({
        magic_link_token: magicLinkToken!,
        state: 'test-oauth-state',
        flow: 'registered'
      });

      await magicLinkHandler.handle(callbackParams, adapters, oauthConfig);

      // Verify the token endpoint was called
      const httpAdapter = adapters.http as MockHttpAdapter;
      const requestHistory = httpAdapter.getRequestHistory();

      // Should call token endpoint
      expect(requestHistory.some(req =>
        req.url.includes('/token')
      )).toBe(true);
    });

    it('should handle registered flow with proper flow parameter validation', async () => {
      // Test that the handler only accepts flow=registered
      const validParams = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'test-state',
        flow: 'registered'
      });

      const invalidParams = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'test-state',
        flow: 'login' // Wrong flow
      });

      expect(magicLinkHandler.canHandle(validParams, oauthConfig)).toBe(true);
      expect(magicLinkHandler.canHandle(invalidParams, oauthConfig)).toBe(false);
    });
  });
});
