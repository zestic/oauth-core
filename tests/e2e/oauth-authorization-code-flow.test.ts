/**
 * End-to-end tests for OAuth Authorization Code Flow
 * Tests the complete traditional OAuth flow with PKCE
 */

import { AuthorizationCodeFlowHandler } from '../../src/flows/AuthorizationCodeFlowHandler';
import { OAuthCore } from '../../src/core/OAuthCore';
import { resolvers, createGraphQLContext } from '../../src/graphql/resolvers';
import type {
  ExtendedOAuthAdapters,
  MagicLinkConfig,
  RegistrationInput
} from '../../src/types/ServiceTypes';
import type { OAuthConfig } from '../../src/types/OAuthTypes';
import {
  createE2EAdapters,
  createTestOAuthConfig,
  createTestMagicLinkConfig,
  setupCommonMocks,
  clearAdapterMocks
} from './utils/test-adapters';

describe('OAuth Authorization Code Flow End-to-End', () => {
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

  describe('Complete Authorization Code Flow with PKCE', () => {
    it('should handle complete OAuth authorization code flow', async () => {
      // Step 1: User registration via GraphQL with PKCE parameters
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

      // Step 2: Generate OAuth authorization URL
      const authUrlResult = await oauthCore.generateAuthorizationUrl();
      
      expect(authUrlResult.url).toContain('response_type=code');
      expect(authUrlResult.url).toContain('client_id=test-client-id');
      expect(authUrlResult.url).toContain('code_challenge=test-challenge');
      expect(authUrlResult.url).toContain('code_challenge_method=S256');
      expect(authUrlResult.state).toBe('test-oauth-state');

      // Step 3: Simulate OAuth provider callback with authorization code
      const callbackParams = new URLSearchParams({
        code: 'authorization-code-123',
        state: authUrlResult.state
      });

      // Mock token exchange response
      (adapters.http.post as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: {
          access_token: 'access-token-123',
          refresh_token: 'refresh-token-123',
          expires_in: 3600,
          token_type: 'Bearer'
        },
        headers: {}
      });

      // Step 4: Handle OAuth callback with authorization code
      const oauthResult = await authCodeHandler.handle(callbackParams, adapters, oauthConfig);

      expect(oauthResult).toEqual({
        success: true,
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresIn: 3600
      });

      // Step 5: Verify tokens were stored
      expect(await adapters.storage.getItem('access_token')).toBe('access-token-123');
      expect(await adapters.storage.getItem('refresh_token')).toBe('refresh-token-123');

      // Step 6: Verify the HTTP request was made with correct parameters
      const tokenExchangeCall = (adapters.http.post as jest.Mock).mock.calls[0];
      expect(tokenExchangeCall[0]).toBe('https://auth.example.com/token');
      expect(tokenExchangeCall[1]).toContain('grant_type=authorization_code');
      expect(tokenExchangeCall[1]).toContain('code=authorization-code-123');
      expect(tokenExchangeCall[1]).toContain('code_verifier=test-verifier');
      expect(tokenExchangeCall[1]).toContain('client_id=test-client-id');
    });

    it('should handle authorization code flow errors gracefully', async () => {
      // Generate authorization URL
      const authUrlResult = await oauthCore.generateAuthorizationUrl();

      // Simulate OAuth callback with error
      const callbackParams = new URLSearchParams({
        error: 'access_denied',
        error_description: 'The user denied the request',
        state: authUrlResult.state
      });

      // Handle callback should throw error
      await expect(
        authCodeHandler.handle(callbackParams, adapters, oauthConfig)
      ).rejects.toThrow();
    });

    it('should validate state parameter during callback', async () => {
      // Generate authorization URL
      const authUrlResult = await oauthCore.generateAuthorizationUrl();

      // Simulate OAuth callback with invalid state
      const callbackParams = new URLSearchParams({
        code: 'authorization-code-123',
        state: 'invalid-state'
      });

      // Handle callback should throw error due to state mismatch
      await expect(
        authCodeHandler.handle(callbackParams, adapters, oauthConfig)
      ).rejects.toThrow();
    });
  });

  describe('PKCE Validation', () => {
    it('should properly validate PKCE challenge and verifier', async () => {
      // Generate authorization URL (creates PKCE challenge)
      const authUrlResult = await oauthCore.generateAuthorizationUrl();
      
      // Simulate successful OAuth callback
      const callbackParams = new URLSearchParams({
        code: 'authorization-code-123',
        state: authUrlResult.state
      });

      // Mock successful token exchange
      (adapters.http.post as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: {
          access_token: 'access-token-123',
          refresh_token: 'refresh-token-123',
          expires_in: 3600,
          token_type: 'Bearer'
        },
        headers: {}
      });

      // Handle callback
      await authCodeHandler.handle(callbackParams, adapters, oauthConfig);

      // Verify PKCE verifier was sent in token exchange
      const tokenExchangeCall = (adapters.http.post as jest.Mock).mock.calls[0];
      expect(tokenExchangeCall[1]).toContain('code_verifier=test-verifier');
    });
  });
});
