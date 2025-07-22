import { resolvers, createGraphQLContext, validationHelpers } from '../../src/graphql/resolvers';
import { OAuthError, OAUTH_ERROR_CODES } from '../../src/types/OAuthTypes';
import type {
  ExtendedOAuthAdapters,
  MagicLinkConfig,
  RegistrationInput,
  SendMagicLinkInput,
  UserRegistrationResult,
  EmailResult
} from '../../src/types/ServiceTypes';


// Mock extended adapters
const createMockExtendedAdapters = (): ExtendedOAuthAdapters => {
  return {
    storage: {
      setItem: jest.fn(),
      getItem: jest.fn(),
      removeItem: jest.fn(),
      removeItems: jest.fn()
    },
    http: {
      post: jest.fn(),
      get: jest.fn()
    },
    pkce: {
      generateCodeChallenge: jest.fn(),
      generateState: jest.fn()
    },
    user: {
      registerUser: jest.fn(),
      userExists: jest.fn(),
      getUserByEmail: jest.fn()
    },
    email: {
      sendMagicLink: jest.fn(),
      sendRegistrationConfirmation: jest.fn()
    }
  };
};

describe('GraphQL Resolvers', () => {
  let mockAdapters: ExtendedOAuthAdapters;
  let mockMagicLinkConfig: MagicLinkConfig;
  let context: any;

  beforeEach(() => {
    mockAdapters = createMockExtendedAdapters();
    mockMagicLinkConfig = {
      baseUrl: 'https://example.com/auth/callback',
      tokenEndpoint: '/oauth/token',
      expirationMinutes: 15
    };
    
    context = createGraphQLContext(mockAdapters, mockMagicLinkConfig);

    // Setup default mocks
    (mockAdapters.user.userExists as jest.Mock).mockResolvedValue(false);
    (mockAdapters.user.registerUser as jest.Mock).mockResolvedValue({
      success: true,
      userId: 'user-123'
    } as UserRegistrationResult);
    (mockAdapters.email.sendRegistrationConfirmation as jest.Mock).mockResolvedValue({
      success: true,
      messageId: 'msg-123'
    } as EmailResult);
    (mockAdapters.email.sendMagicLink as jest.Mock).mockResolvedValue({
      success: true,
      messageId: 'msg-456'
    } as EmailResult);
    (mockAdapters.pkce.generateCodeChallenge as jest.Mock).mockResolvedValue({
      codeChallenge: 'mock-challenge',
      codeChallengeMethod: 'S256',
      codeVerifier: 'mock-verifier'
    });
  });

  describe('Query resolvers', () => {
    it('should return empty string for _empty query', () => {
      const result = resolvers.Query._empty();
      expect(result).toBe('OAuth Core GraphQL API');
    });
  });

  describe('Mutation resolvers', () => {
    describe('register', () => {
      const validRegistrationInput: RegistrationInput = {
        email: 'test@example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://example.com/callback',
        state: 'test-state'
      };

      it('should successfully register a user', async () => {
        const result = await resolvers.Mutation.register(
          null,
          { input: validRegistrationInput },
          context
        );

        expect(result).toEqual({
          success: true,
          message: 'User registered successfully',
          code: 'REGISTRATION_SUCCESS'
        });

        expect(mockAdapters.user.userExists).toHaveBeenCalledWith('test@example.com');
        expect(mockAdapters.user.registerUser).toHaveBeenCalledWith(
          'test@example.com',
          { firstName: 'John', lastName: 'Doe' }
        );
      });

      it('should handle user already exists', async () => {
        (mockAdapters.user.userExists as jest.Mock).mockResolvedValue(true);

        const result = await resolvers.Mutation.register(
          null,
          { input: validRegistrationInput },
          context
        );

        expect(result).toEqual({
          success: false,
          message: 'User already exists with this email address',
          code: 'USER_EXISTS'
        });

        expect(mockAdapters.user.registerUser).not.toHaveBeenCalled();
      });

      it('should handle registration failure', async () => {
        (mockAdapters.user.registerUser as jest.Mock).mockResolvedValue({
          success: false,
          message: 'Database error'
        } as UserRegistrationResult);

        const result = await resolvers.Mutation.register(
          null,
          { input: validRegistrationInput },
          context
        );

        expect(result).toEqual({
          success: false,
          message: 'Database error',
          code: 'REGISTRATION_FAILED'
        });
      });

      it('should handle OAuth errors gracefully', async () => {
        const oauthError = new OAuthError('Invalid email', OAUTH_ERROR_CODES.MISSING_REQUIRED_PARAMETER);
        (mockAdapters.user.userExists as jest.Mock).mockRejectedValue(oauthError);

        const result = await resolvers.Mutation.register(
          null,
          { input: validRegistrationInput },
          context
        );

        expect(result).toEqual({
          success: false,
          message: 'Invalid email',
          code: 'missing_required_parameter'
        });
      });

      it('should handle unexpected errors', async () => {
        const genericError = new Error('Unexpected error');
        (mockAdapters.user.userExists as jest.Mock).mockRejectedValue(genericError);

        const result = await resolvers.Mutation.register(
          null,
          { input: validRegistrationInput },
          context
        );

        expect(result).toEqual({
          success: false,
          message: 'Registration failed: Unexpected error',
          code: 'invalid_configuration'
        });
      });
    });

    describe('sendMagicLink', () => {
      const validMagicLinkInput: SendMagicLinkInput = {
        email: 'test@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://example.com/callback',
        state: 'test-state'
      };

      it('should successfully send magic link', async () => {
        const result = await resolvers.Mutation.sendMagicLink(
          null,
          { input: validMagicLinkInput },
          context
        );

        expect(result).toEqual({
          success: true,
          message: 'Magic link sent successfully',
          code: 'MAGIC_LINK_SENT'
        });

        expect(mockAdapters.email.sendMagicLink).toHaveBeenCalled();
      });

      it('should handle email sending failure', async () => {
        (mockAdapters.email.sendMagicLink as jest.Mock).mockResolvedValue({
          success: false,
          message: 'Email service unavailable'
        } as EmailResult);

        const result = await resolvers.Mutation.sendMagicLink(
          null,
          { input: validMagicLinkInput },
          context
        );

        expect(result).toEqual({
          success: false,
          message: 'Email service unavailable',
          code: 'EMAIL_SEND_FAILED'
        });
      });

      it('should handle OAuth errors gracefully', async () => {
        const oauthError = new OAuthError('Invalid state', OAUTH_ERROR_CODES.INVALID_STATE);
        (mockAdapters.user.userExists as jest.Mock).mockRejectedValue(oauthError);

        const result = await resolvers.Mutation.sendMagicLink(
          null,
          { input: validMagicLinkInput },
          context
        );

        expect(result).toEqual({
          success: false,
          message: 'Invalid state',
          code: 'invalid_state'
        });
      });

      it('should handle unexpected errors', async () => {
        const genericError = new Error('Unexpected error');
        (mockAdapters.user.userExists as jest.Mock).mockRejectedValue(genericError);

        const result = await resolvers.Mutation.sendMagicLink(
          null,
          { input: validMagicLinkInput },
          context
        );

        expect(result).toEqual({
          success: false,
          message: 'Magic link sending failed: Unexpected error',
          code: 'invalid_configuration'
        });
      });
    });
  });

  describe('JSON scalar', () => {
    it('should serialize values correctly', () => {
      expect(resolvers.JSON.serialize('string')).toBe('string');
      expect(resolvers.JSON.serialize(123)).toBe(123);
      expect(resolvers.JSON.serialize({ key: 'value' })).toEqual({ key: 'value' });
      expect(resolvers.JSON.serialize(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('should parse values correctly', () => {
      expect(resolvers.JSON.parseValue('string')).toBe('string');
      expect(resolvers.JSON.parseValue(123)).toBe(123);
      expect(resolvers.JSON.parseValue({ key: 'value' })).toEqual({ key: 'value' });
    });

    it('should parse literals correctly', () => {
      // String literal
      expect(resolvers.JSON.parseLiteral({ kind: 'StringValue', value: 'test' })).toBe('test');
      
      // Boolean literal
      expect(resolvers.JSON.parseLiteral({ kind: 'BooleanValue', value: true })).toBe(true);
      
      // Int literal
      expect(resolvers.JSON.parseLiteral({ kind: 'IntValue', value: '123' })).toBe(123);
      
      // Float literal
      expect(resolvers.JSON.parseLiteral({ kind: 'FloatValue', value: '123.45' })).toBe(123.45);
      
      // Null literal
      expect(resolvers.JSON.parseLiteral({ kind: 'NullValue' })).toBe(null);
      
      // Object literal
      const objectLiteral = {
        kind: 'ObjectValue',
        fields: [
          {
            name: { value: 'key' },
            value: { kind: 'StringValue', value: 'value' }
          }
        ]
      };
      expect(resolvers.JSON.parseLiteral(objectLiteral)).toEqual({ key: 'value' });
      
      // List literal
      const listLiteral = {
        kind: 'ListValue',
        values: [
          { kind: 'StringValue', value: 'a' },
          { kind: 'StringValue', value: 'b' }
        ]
      };
      expect(resolvers.JSON.parseLiteral(listLiteral)).toEqual(['a', 'b']);
    });

    it('should throw error for unsupported literal kinds', () => {
      expect(() => {
        resolvers.JSON.parseLiteral({ kind: 'UnsupportedKind' });
      }).toThrow('Unexpected kind in JSON literal: UnsupportedKind');
    });
  });

  describe('createGraphQLContext', () => {
    it('should create context with adapters and config', () => {
      const context = createGraphQLContext(mockAdapters, mockMagicLinkConfig);

      expect(context).toEqual({
        adapters: mockAdapters,
        magicLinkConfig: mockMagicLinkConfig
      });
    });
  });

  describe('validationHelpers', () => {
    describe('validateContext', () => {
      it('should pass validation for valid context', () => {
        expect(() => {
          validationHelpers.validateContext(context);
        }).not.toThrow();
      });

      it('should throw error for missing adapters', () => {
        const invalidContext = { magicLinkConfig: mockMagicLinkConfig };

        expect(() => {
          validationHelpers.validateContext(invalidContext as any);
        }).toThrow('OAuth adapters not provided in GraphQL context');
      });

      it('should throw error for missing user adapter', () => {
        const invalidContext = {
          adapters: { ...mockAdapters, user: undefined },
          magicLinkConfig: mockMagicLinkConfig
        };

        expect(() => {
          validationHelpers.validateContext(invalidContext as any);
        }).toThrow('User adapter not provided in GraphQL context');
      });

      it('should throw error for missing email adapter', () => {
        const invalidContext = {
          adapters: { ...mockAdapters, email: undefined },
          magicLinkConfig: mockMagicLinkConfig
        };

        expect(() => {
          validationHelpers.validateContext(invalidContext as any);
        }).toThrow('Email adapter not provided in GraphQL context');
      });

      it('should throw error for missing magic link config', () => {
        const invalidContext = { adapters: mockAdapters };

        expect(() => {
          validationHelpers.validateContext(invalidContext as any);
        }).toThrow('Magic link configuration not provided in GraphQL context');
      });
    });

    describe('sanitizeError', () => {
      it('should preserve OAuth error details', () => {
        const oauthError = new OAuthError('Invalid state', OAUTH_ERROR_CODES.INVALID_STATE);
        const result = validationHelpers.sanitizeError(oauthError);

        expect(result).toEqual({
          message: 'Invalid state',
          code: 'invalid_state'
        });
      });

      it('should sanitize non-OAuth errors', () => {
        const genericError = new Error('Database connection failed');
        const result = validationHelpers.sanitizeError(genericError);

        expect(result).toEqual({
          message: 'An internal error occurred',
          code: 'INTERNAL_ERROR'
        });
      });

      it('should handle non-Error objects', () => {
        const result = validationHelpers.sanitizeError('string error');

        expect(result).toEqual({
          message: 'An internal error occurred',
          code: 'INTERNAL_ERROR'
        });
      });
    });
  });
});
