/**
 * End-to-end tests for GraphQL + OAuth flow
 * Tests the complete flow from GraphQL mutations to OAuth callback handling
 */

import { MagicLinkFlowHandler } from '../../src/flows/MagicLinkFlowHandler';
import { AuthorizationCodeFlowHandler } from '../../src/flows/AuthorizationCodeFlowHandler';
import { OAuthCore } from '../../src/core/OAuthCore';
import { resolvers, createGraphQLContext } from '../../src/graphql/resolvers';
import type {
  ExtendedOAuthAdapters,
  MagicLinkConfig,
  RegistrationInput,
  SendMagicLinkInput,
  UserRegistrationResult,
  EmailResult
} from '../../src/types/ServiceTypes';
import type { OAuthConfig } from '../../src/types/OAuthTypes';
import {
  createE2EAdapters,
  createTestOAuthConfig,
  createTestMagicLinkConfig,
  setupCommonMocks
} from './utils/test-adapters';


describe('GraphQL + OAuth End-to-End', () => {
  let adapters: ExtendedOAuthAdapters;
  let oauthConfig: OAuthConfig;
  let magicLinkConfig: MagicLinkConfig;
  let graphqlContext: any;
  let magicLinkHandler: MagicLinkFlowHandler;
  let oauthCore: OAuthCore;
  let authCodeHandler: AuthorizationCodeFlowHandler;

  beforeEach(() => {
    adapters = createE2EAdapters();
    oauthConfig = createTestOAuthConfig();
    magicLinkConfig = createTestMagicLinkConfig();

    graphqlContext = createGraphQLContext(adapters, magicLinkConfig);
    magicLinkHandler = new MagicLinkFlowHandler();
    oauthCore = new OAuthCore(oauthConfig, adapters);
    authCodeHandler = new AuthorizationCodeFlowHandler();

    // Setup common mocks
    setupCommonMocks(adapters);
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

      // Verify magic link email was sent
      expect(adapters.email.sendMagicLink).toHaveBeenCalled();

      // Verify PKCE data was updated for magic link flow
      expect(await adapters.storage.getItem('pkce_challenge')).toBe('magic-link-challenge');
      expect(await adapters.storage.getItem('pkce_state')).toBe('magic-link-state');

      // Step 3: Extract magic link token from email call
      const emailCall = (adapters.email.sendMagicLink as jest.Mock).mock.calls[0];
      const magicLinkUrl = emailCall[1];
      const urlParams = new URL(magicLinkUrl).searchParams;
      const magicLinkToken = urlParams.get('magic_link_token');
      const state = urlParams.get('state');

      expect(magicLinkToken).toBeTruthy();
      expect(state).toBe('magic-link-state');

      // Step 4: Simulate user clicking magic link (OAuth callback)
      const callbackParams = new URLSearchParams({
        magic_link_token: magicLinkToken!,
        state: state!,
        flow: 'magic_link'
      });

      // Verify magic link handler can handle the callback
      expect(magicLinkHandler.canHandle(callbackParams)).toBe(true);

      // Mock token exchange response
      (adapters.http.post as jest.Mock).mockResolvedValue({
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

      // Should still send magic link even if user doesn't exist
      expect(adapters.email.sendMagicLink).toHaveBeenCalled();

      // Step 2: Simulate OAuth callback
      const emailCall = (adapters.email.sendMagicLink as jest.Mock).mock.calls[0];
      const magicLinkUrl = emailCall[1];
      const urlParams = new URL(magicLinkUrl).searchParams;
      const magicLinkToken = urlParams.get('magic_link_token');

      const callbackParams = new URLSearchParams({
        magic_link_token: magicLinkToken!,
        state: 'direct-state'
      });

      // Mock successful token exchange
      (adapters.http.post as jest.Mock).mockResolvedValue({
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

  describe('Complete Registration + OAuth Authorization Code Flow', () => {
    it('should handle complete user registration and traditional OAuth flow', async () => {
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

      // Verify PKCE data was stored during registration
      expect(await adapters.storage.getItem('pkce_challenge')).toBe('registration-challenge');
      expect(await adapters.storage.getItem('pkce_state')).toBe('registration-state');

      // Step 2: Generate OAuth authorization URL
      const authUrlResult = await oauthCore.generateAuthorizationUrl({
        email: 'user@example.com',
        flow: 'registration'
      });

      expect(authUrlResult.url).toContain('response_type=code');
      expect(authUrlResult.url).toContain('client_id=test-client-id');
      expect(authUrlResult.url).toContain('redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback');
      expect(authUrlResult.url).toContain('code_challenge=test-challenge');
      expect(authUrlResult.url).toContain('code_challenge_method=S256');
      expect(authUrlResult.url).toContain('state=test-oauth-state');
      expect(authUrlResult.state).toBe('test-oauth-state');

      // Verify OAuth state was stored
      expect(await adapters.storage.getItem('oauth_state')).toBe('test-oauth-state');

      // Step 3: Simulate OAuth provider callback with authorization code
      const callbackParams = new URLSearchParams({
        code: 'test-authorization-code',
        state: 'test-oauth-state'
      });

      // Verify the handler can handle this callback
      expect(authCodeHandler.canHandle(callbackParams)).toBe(true);

      // Mock successful token exchange
      (adapters.http.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          access_token: 'oauth-access-token-123',
          refresh_token: 'oauth-refresh-token-456',
          expires_in: 3600,
          token_type: 'Bearer'
        },
        headers: {}
      });

      // Step 4: Handle the OAuth callback
      const oauthResult = await authCodeHandler.handle(callbackParams, adapters, oauthConfig);

      expect(oauthResult).toEqual({
        success: true,
        accessToken: 'oauth-access-token-123',
        refreshToken: 'oauth-refresh-token-456',
        expiresIn: 3600
      });

      // Verify tokens were stored
      expect(await adapters.storage.getItem('access_token')).toBe('oauth-access-token-123');
      expect(await adapters.storage.getItem('refresh_token')).toBe('oauth-refresh-token-456');

      // Verify PKCE data was cleaned up after successful exchange
      expect(await adapters.storage.getItem('pkce_code_verifier')).toBeNull();

      // Verify state was cleaned up after validation
      expect(await adapters.storage.getItem('oauth_state')).toBeNull();
    });

    it('should validate state parameter during OAuth callback', async () => {
      // Step 1: Generate authorization URL with specific state
      const authUrlResult = await oauthCore.generateAuthorizationUrl();
      const expectedState = authUrlResult.state;

      // Step 2: Simulate callback with correct state
      const callbackParams = new URLSearchParams({
        code: 'test-authorization-code',
        state: expectedState
      });

      // Mock successful token exchange
      (adapters.http.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer'
        },
        headers: {}
      });

      const result = await authCodeHandler.handle(callbackParams, adapters, oauthConfig);
      expect(result.success).toBe(true);
    });

    it('should reject callback with invalid state', async () => {
      // Step 1: Generate authorization URL
      await oauthCore.generateAuthorizationUrl();

      // Step 2: Simulate callback with wrong state
      const callbackParams = new URLSearchParams({
        code: 'test-authorization-code',
        state: 'wrong-state'
      });

      // Should throw error due to invalid state
      await expect(
        authCodeHandler.handle(callbackParams, adapters, oauthConfig)
      ).rejects.toThrow();
    });

    it('should handle OAuth error in callback', async () => {
      // Simulate OAuth provider returning an error
      const callbackParams = new URLSearchParams({
        error: 'access_denied',
        error_description: 'User denied access',
        state: 'test-state'
      });

      // Should not be able to handle error callbacks
      expect(authCodeHandler.canHandle(callbackParams)).toBe(false);
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

    it('should handle email service failure', async () => {
      (adapters.email.sendMagicLink as jest.Mock).mockResolvedValue({
        success: false,
        message: 'SMTP server unavailable'
      } as EmailResult);

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

      expect(result).toEqual({
        success: false,
        message: 'SMTP server unavailable',
        code: 'EMAIL_SEND_FAILED'
      });
    });

    it('should handle OAuth token exchange failure', async () => {
      // Setup magic link first
      const magicLinkInput: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      await resolvers.Mutation.sendMagicLink(null, { input: magicLinkInput }, graphqlContext);

      // Get magic link token
      const emailCall = (adapters.email.sendMagicLink as jest.Mock).mock.calls[0];
      const magicLinkUrl = emailCall[1];
      const urlParams = new URL(magicLinkUrl).searchParams;
      const magicLinkToken = urlParams.get('magic_link_token');

      // Mock token exchange failure
      (adapters.http.post as jest.Mock).mockResolvedValue({
        status: 400,
        data: { error: 'invalid_grant', error_description: 'Invalid magic link token' },
        headers: {}
      });

      const callbackParams = new URLSearchParams({
        magic_link_token: magicLinkToken!,
        state: 'test-state'
      });

      await expect(
        magicLinkHandler.handle(callbackParams, adapters, oauthConfig)
      ).rejects.toThrow();
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
      (adapters.http.post as jest.Mock).mockResolvedValue({
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
