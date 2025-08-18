/**
 * Unit tests for GraphQL resolvers
 */

import { resolvers, createGraphQLContext, validationHelpers } from '../../src/graphql/resolvers';
import type {
  ExtendedOAuthAdapters,
  MagicLinkConfig,
  RegistrationInput,
  SendMagicLinkInput,
  UserRegistrationResult,
  MagicLinkResponse
} from '../../src/types/ServiceTypes';
import { OAuthError } from '../../src/errors';
import { createE2EAdapters, createTestMagicLinkConfig, setupCommonMocks } from '../integration/utils/test-adapters';

describe('GraphQL Resolvers', () => {
  let adapters: ExtendedOAuthAdapters;
  let magicLinkConfig: MagicLinkConfig;
  let graphqlContext: any;

  beforeEach(() => {
    adapters = createE2EAdapters();
    magicLinkConfig = createTestMagicLinkConfig();
    setupCommonMocks(adapters);
    graphqlContext = createGraphQLContext(adapters, magicLinkConfig);
  });

  describe('Query._empty', () => {
    it('should return placeholder message', () => {
      const result = resolvers.Query._empty();
      expect(result).toBe('OAuth Core GraphQL API');
    });
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
        message: 'Registration failed: Database connection failed',
        code: 'invalid_configuration'
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
        message: 'Missing required parameter: email',
        code: 'VALIDATION_MISSING_PARAMETER'
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

    it('should handle unexpected non-OAuth errors', async () => {
      // Mock the RegistrationService constructor to throw a non-OAuth error
      const originalRegistrationService = require('../../src/services/RegistrationService').RegistrationService;
      const mockConstructor = jest.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });
      require('../../src/services/RegistrationService').RegistrationService = mockConstructor;

      const input: RegistrationInput = {
        email: 'test@example.com',
        additionalData: { name: 'Test User' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      const result = await resolvers.Mutation.register(null, { input }, graphqlContext);

      expect(result).toEqual({
        success: false,
        message: 'An unexpected error occurred during registration',
        code: 'INTERNAL_ERROR'
      });

      // Restore original constructor
      require('../../src/services/RegistrationService').RegistrationService = originalRegistrationService;
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
        message: 'Magic link sent successfully',
        code: 'MAGIC_LINK_SENT'
      });

      expect(adapters.graphql.sendMagicLinkMutation).toHaveBeenCalledWith(
        'user@example.com',
        expect.stringContaining('token='),
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
        message: 'Email service unavailable',
        error: 'Email service unavailable'
      });

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
        message: 'Email service unavailable',
        code: 'GRAPHQL_MUTATION_FAILED'
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
        message: 'Magic link sending failed: Network timeout',
        code: 'invalid_configuration'
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
      expect(result.message).toContain('Invalid email format');
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
      expect(result.message).toContain('Missing required parameter: codeChallenge');
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
      expect(url.searchParams.get('token')).toBeTruthy();
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

      expect(emailOptions.subject).toBe('Your Magic Link');
      expect(emailOptions.templateData.email).toBe('template-test@example.com');
      expect(emailOptions.templateData.expirationMinutes).toBe(15);
      expect(emailOptions.templateData.magicLinkUrl).toBeDefined();
    });

    it('should handle unexpected non-OAuth errors in sendMagicLink', async () => {
      // Mock the MagicLinkService constructor to throw a non-OAuth error
      const originalMagicLinkService = require('../../src/services/MagicLinkService').MagicLinkService;
      const mockConstructor = jest.fn().mockImplementation(() => {
        throw new Error('Configuration error');
      });
      require('../../src/services/MagicLinkService').MagicLinkService = mockConstructor;

      const input: SendMagicLinkInput = {
        email: 'test@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      const result = await resolvers.Mutation.sendMagicLink(null, { input }, graphqlContext);

      expect(result).toEqual({
        success: false,
        message: 'An unexpected error occurred while sending magic link',
        code: 'INTERNAL_ERROR'
      });

      // Restore original constructor
      require('../../src/services/MagicLinkService').MagicLinkService = originalMagicLinkService;
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

  describe('JSON scalar resolver', () => {
    it('should serialize values', () => {
      const testValue = { test: 'value' };
      expect(resolvers.JSON.serialize(testValue)).toBe(testValue);
    });

    it('should parse values', () => {
      const testValue = { test: 'value' };
      expect(resolvers.JSON.parseValue(testValue)).toBe(testValue);
    });

    it('should parse string literals', () => {
      const ast = { kind: 'StringValue', value: 'test' };
      expect(resolvers.JSON.parseLiteral(ast)).toBe('test');
    });

    it('should parse boolean literals', () => {
      const ast = { kind: 'BooleanValue', value: true };
      expect(resolvers.JSON.parseLiteral(ast)).toBe(true);
    });

    it('should parse int literals', () => {
      const ast = { kind: 'IntValue', value: 42 };
      expect(resolvers.JSON.parseLiteral(ast)).toBe(42);
    });

    it('should parse float literals', () => {
      const ast = { kind: 'FloatValue', value: 3.14 };
      expect(resolvers.JSON.parseLiteral(ast)).toBe(3.14);
    });

    it('should parse null literals', () => {
      const ast = { kind: 'NullValue' };
      expect(resolvers.JSON.parseLiteral(ast)).toBe(null);
    });

    it('should parse object literals', () => {
      const ast = {
        kind: 'ObjectValue',
        fields: [
          {
            name: { value: 'key' },
            value: { kind: 'StringValue', value: 'value' }
          }
        ]
      };
      expect(resolvers.JSON.parseLiteral(ast)).toEqual({ key: 'value' });
    });

    it('should parse list literals', () => {
      const ast = {
        kind: 'ListValue',
        values: [
          { kind: 'StringValue', value: 'item1' },
          { kind: 'StringValue', value: 'item2' }
        ]
      };
      expect(resolvers.JSON.parseLiteral(ast)).toEqual(['item1', 'item2']);
    });

    it('should handle empty object literals', () => {
      const ast = { kind: 'ObjectValue', fields: undefined };
      expect(resolvers.JSON.parseLiteral(ast)).toEqual({});
    });

    it('should handle empty list literals', () => {
      const ast = { kind: 'ListValue', values: undefined };
      expect(resolvers.JSON.parseLiteral(ast)).toEqual([]);
    });

    it('should throw error for unknown literal kinds', () => {
      const ast = { kind: 'UnknownValue' };
      expect(() => resolvers.JSON.parseLiteral(ast)).toThrow('Unexpected kind in JSON literal: UnknownValue');
    });
  });

  describe('validationHelpers', () => {
    it('should validate context with all required fields', () => {
      expect(() => validationHelpers.validateContext(graphqlContext)).not.toThrow();
    });

    it('should throw error when adapters are missing', () => {
      const invalidContext = { ...graphqlContext, adapters: null };
      expect(() => validationHelpers.validateContext(invalidContext)).toThrow('OAuth adapters not provided in GraphQL context');
    });

    it('should throw error when user adapter is missing', () => {
      const invalidContext = { ...graphqlContext, adapters: { ...adapters, user: null } };
      expect(() => validationHelpers.validateContext(invalidContext)).toThrow('User adapter not provided in GraphQL context');
    });

    it('should throw error when graphql adapter is missing', () => {
      const invalidContext = { ...graphqlContext, adapters: { ...adapters, graphql: null } };
      expect(() => validationHelpers.validateContext(invalidContext)).toThrow('GraphQL adapter not provided in GraphQL context');
    });

    it('should throw error when magic link config is missing', () => {
      const invalidContext = { ...graphqlContext, magicLinkConfig: null };
      expect(() => validationHelpers.validateContext(invalidContext)).toThrow('Magic link configuration not provided in GraphQL context');
    });

    it('should sanitize OAuth errors', () => {
      const oauthError = new OAuthError('OAuth error', 'TOKEN_INVALID_GRANT', 'auth');
      const result = validationHelpers.sanitizeError(oauthError);
      expect(result).toEqual({ message: 'OAuth error', code: 'TOKEN_INVALID_GRANT' });
    });

    it('should sanitize non-OAuth errors', () => {
      const genericError = new Error('Database error');
      const result = validationHelpers.sanitizeError(genericError);
      expect(result).toEqual({ message: 'An internal error occurred', code: 'INTERNAL_ERROR' });
    });
  });
});
