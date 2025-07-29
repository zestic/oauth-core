/**
 * Unit tests for GraphQL resolvers
 */

import { resolvers, createGraphQLContext } from '../../src/graphql/resolvers';
import type {
  ExtendedOAuthAdapters,
  MagicLinkConfig,
  RegistrationInput,
  SendMagicLinkInput,
  UserRegistrationResult,
  MagicLinkResponse
} from '../../src/types/ServiceTypes';
import { createE2EAdapters, createTestMagicLinkConfig } from '../integration/utils/test-adapters';

describe('GraphQL Resolvers', () => {
  let adapters: ExtendedOAuthAdapters;
  let magicLinkConfig: MagicLinkConfig;
  let graphqlContext: any;

  beforeEach(() => {
    adapters = createE2EAdapters();
    magicLinkConfig = createTestMagicLinkConfig();
    graphqlContext = createGraphQLContext(adapters, magicLinkConfig);
  });

  describe('Mutation.register', () => {
    it('should successfully register a new user', async () => {
      // Mock successful registration
      (adapters.user.registerUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'User registered successfully',
        code: 'REGISTRATION_SUCCESS'
      } as UserRegistrationResult);

      const input: RegistrationInput = {
        email: 'newuser@example.com',
        additionalData: {
          firstName: 'John',
          lastName: 'Doe'
        },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      const result = await resolvers.Mutation.register(null, { input }, graphqlContext);

      expect(result).toEqual({
        success: true,
        message: 'User registered successfully',
        code: 'REGISTRATION_SUCCESS'
      });

      expect(adapters.user.registerUser).toHaveBeenCalledWith(
        'newuser@example.com',
        { firstName: 'John', lastName: 'Doe' }
      );
    });

    it('should handle registration failure', async () => {
      // Mock registration failure
      (adapters.user.registerUser as jest.Mock).mockResolvedValue({
        success: false,
        message: 'Email already exists',
        code: 'REGISTRATION_FAILED'
      } as UserRegistrationResult);

      const input: RegistrationInput = {
        email: 'existing@example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      const result = await resolvers.Mutation.register(null, { input }, graphqlContext);

      expect(result).toEqual({
        success: false,
        message: 'Email already exists',
        code: 'REGISTRATION_FAILED'
      });
    });

    it('should handle registration service errors', async () => {
      // Mock service throwing an error
      (adapters.user.registerUser as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      const input: RegistrationInput = {
        email: 'test@example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      const result = await resolvers.Mutation.register(null, { input }, graphqlContext);

      expect(result).toEqual({
        success: false,
        message: 'Registration failed due to an internal error',
        code: 'REGISTRATION_ERROR'
      });
    });

    it('should handle missing required fields', async () => {
      const input: RegistrationInput = {
        email: '', // Empty email
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      const result = await resolvers.Mutation.register(null, { input }, graphqlContext);

      expect(result).toEqual({
        success: false,
        message: 'Registration failed due to an internal error',
        code: 'REGISTRATION_ERROR'
      });
    });

    it('should handle registration with minimal data', async () => {
      (adapters.user.registerUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'User registered successfully',
        code: 'REGISTRATION_SUCCESS'
      } as UserRegistrationResult);

      const input: RegistrationInput = {
        email: 'minimal@example.com',
        additionalData: {}, // Empty additional data
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      const result = await resolvers.Mutation.register(null, { input }, graphqlContext);

      expect(result.success).toBe(true);
      expect(adapters.user.registerUser).toHaveBeenCalledWith('minimal@example.com', {});
    });
  });

  describe('Mutation.sendMagicLink', () => {
    it('should successfully send magic link', async () => {
      // Mock successful magic link sending
      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Magic link sent successfully'
      } as MagicLinkResponse);

      const input: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      const result = await resolvers.Mutation.sendMagicLink(null, { input }, graphqlContext);

      expect(result).toEqual({
        success: true,
        message: 'Magic link sent successfully'
      });

      expect(adapters.graphql.sendMagicLinkMutation).toHaveBeenCalledWith(
        'user@example.com',
        expect.stringContaining('magic_link_token='),
        expect.objectContaining({
          subject: 'Your Magic Link',
          templateData: expect.objectContaining({
            email: 'user@example.com',
            expirationMinutes: 15
          })
        })
      );
    });

    it('should handle magic link service failure', async () => {
      // Mock service failure
      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Email service unavailable'
      } as MagicLinkResponse);

      const input: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      const result = await resolvers.Mutation.sendMagicLink(null, { input }, graphqlContext);

      expect(result).toEqual({
        success: false,
        message: 'Failed to send magic link: Email service unavailable'
      });
    });

    it('should handle magic link service errors', async () => {
      // Mock service throwing an error
      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      const input: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      const result = await resolvers.Mutation.sendMagicLink(null, { input }, graphqlContext);

      expect(result).toEqual({
        success: false,
        message: 'Failed to send magic link due to an internal error'
      });
    });

    it('should handle invalid email format', async () => {
      const input: SendMagicLinkInput = {
        email: 'invalid-email', // Invalid email format
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      const result = await resolvers.Mutation.sendMagicLink(null, { input }, graphqlContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain('internal error');
    });

    it('should handle missing required fields', async () => {
      const input: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: '', // Empty code challenge
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      const result = await resolvers.Mutation.sendMagicLink(null, { input }, graphqlContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain('internal error');
    });

    it('should generate proper magic link URL with all parameters', async () => {
      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Magic link sent successfully'
      } as MagicLinkResponse);

      const input: SendMagicLinkInput = {
        email: 'test@example.com',
        codeChallenge: 'test-challenge-123',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/auth/callback',
        state: 'test-state-456'
      };

      await resolvers.Mutation.sendMagicLink(null, { input }, graphqlContext);

      const call = (adapters.graphql.sendMagicLinkMutation as jest.Mock).mock.calls[0];
      const magicLinkUrl = call[1];

      // Verify URL contains all required parameters
      const url = new URL(magicLinkUrl);
      expect(url.searchParams.get('magic_link_token')).toBeTruthy();
      expect(url.searchParams.get('state')).toBe('test-state-456');
      expect(url.searchParams.get('flow')).toBe('magic_link');
    });

    it('should use correct email template data', async () => {
      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Magic link sent successfully'
      } as MagicLinkResponse);

      const input: SendMagicLinkInput = {
        email: 'template-test@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      await resolvers.Mutation.sendMagicLink(null, { input }, graphqlContext);

      const call = (adapters.graphql.sendMagicLinkMutation as jest.Mock).mock.calls[0];
      const emailOptions = call[2];

      expect(emailOptions).toEqual({
        subject: 'Your Magic Link',
        templateData: {
          email: 'template-test@example.com',
          expirationMinutes: 15
        }
      });
    });
  });

  describe('createGraphQLContext', () => {
    it('should create context with adapters and config', () => {
      const context = createGraphQLContext(adapters, magicLinkConfig);

      expect(context.adapters).toBe(adapters);
      expect(context.magicLinkConfig).toBe(magicLinkConfig);
    });

    it('should create context with different configurations', () => {
      const customConfig = {
        ...magicLinkConfig,
        expirationMinutes: 30
      };

      const context = createGraphQLContext(adapters, customConfig);

      expect(context.magicLinkConfig.expirationMinutes).toBe(30);
    });
  });
});
