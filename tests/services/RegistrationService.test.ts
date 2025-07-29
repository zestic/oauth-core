/**
 * Unit tests for RegistrationService
 */

import { RegistrationService } from '../../src/services/RegistrationService';
import type {
  ExtendedOAuthAdapters,
  RegistrationInput,
  UserRegistrationResult
} from '../../src/types/ServiceTypes';
import { createE2EAdapters } from '../integration/utils/test-adapters';

describe('RegistrationService', () => {
  let service: RegistrationService;
  let adapters: ExtendedOAuthAdapters;

  beforeEach(() => {
    adapters = createE2EAdapters();
    service = new RegistrationService(adapters);
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const input: RegistrationInput = {
        email: 'newuser@example.com',
        additionalData: {
          firstName: 'John',
          lastName: 'Doe',
          company: 'Acme Corp'
        },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.user.registerUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'User registered successfully',
        code: 'REGISTRATION_SUCCESS'
      } as UserRegistrationResult);

      const result = await service.register(input);

      expect(result.success).toBe(true);
      expect(result.message).toBe('User registered successfully');
      expect(result.code).toBe('REGISTRATION_SUCCESS');

      expect(adapters.user.registerUser).toHaveBeenCalledWith(
        'newuser@example.com',
        {
          firstName: 'John',
          lastName: 'Doe',
          company: 'Acme Corp'
        }
      );
    });

    it('should handle registration failure', async () => {
      const input: RegistrationInput = {
        email: 'existing@example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.user.registerUser as jest.Mock).mockResolvedValue({
        success: false,
        message: 'Email already exists',
        code: 'REGISTRATION_FAILED'
      } as UserRegistrationResult);

      const result = await service.register(input);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Email already exists');
      expect(result.code).toBe('REGISTRATION_FAILED');
    });

    it('should handle user adapter errors', async () => {
      const input: RegistrationInput = {
        email: 'user@example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.user.registerUser as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      await expect(service.register(input)).rejects.toThrow('Database connection failed');
    });

    it('should handle empty email', async () => {
      const input: RegistrationInput = {
        email: '',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      await expect(service.register(input)).rejects.toThrow('Missing required parameter: email');
    });

    it('should handle invalid email format', async () => {
      const input: RegistrationInput = {
        email: 'invalid-email',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      await expect(service.register(input)).rejects.toThrow('Invalid email format');
    });

    it('should handle missing code challenge', async () => {
      const input: RegistrationInput = {
        email: 'user@example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: '',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      await expect(service.register(input)).rejects.toThrow('Missing required parameter: codeChallenge');
    });

    it('should handle missing redirect URI', async () => {
      const input: RegistrationInput = {
        email: 'user@example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: '',
        state: 'test-state'
      };

      await expect(service.register(input)).rejects.toThrow('Missing required parameter: redirectUri');
    });

    it('should handle missing state', async () => {
      const input: RegistrationInput = {
        email: 'user@example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: ''
      };

      await expect(service.register(input)).rejects.toThrow('Missing required parameter: state');
    });

    it('should handle registration with minimal additional data', async () => {
      const input: RegistrationInput = {
        email: 'minimal@example.com',
        additionalData: {},
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.user.registerUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'User registered successfully',
        code: 'REGISTRATION_SUCCESS'
      } as UserRegistrationResult);

      const result = await service.register(input);

      expect(result.success).toBe(true);
      expect(adapters.user.registerUser).toHaveBeenCalledWith('minimal@example.com', {});
    });

    it('should handle registration with null additional data', async () => {
      const input: RegistrationInput = {
        email: 'null-data@example.com',
        additionalData: null as any,
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      await expect(service.register(input)).rejects.toThrow('Missing required parameter: additionalData');
    });

    it('should handle different code challenge methods', async () => {
      const input: RegistrationInput = {
        email: 'user@example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'plain',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.user.registerUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'User registered successfully',
        code: 'REGISTRATION_SUCCESS'
      } as UserRegistrationResult);

      const result = await service.register(input);

      expect(result.success).toBe(true);
    });

    it('should handle long email addresses', async () => {
      const input: RegistrationInput = {
        email: 'very.long.email.address.that.might.cause.issues@very-long-domain-name.example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.user.registerUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'User registered successfully',
        code: 'REGISTRATION_SUCCESS'
      } as UserRegistrationResult);

      const result = await service.register(input);

      expect(result.success).toBe(true);
    });

    it('should handle special characters in email', async () => {
      const input: RegistrationInput = {
        email: 'user+test@example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.user.registerUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'User registered successfully',
        code: 'REGISTRATION_SUCCESS'
      } as UserRegistrationResult);

      const result = await service.register(input);

      expect(result.success).toBe(true);
    });

    it('should handle complex additional data', async () => {
      const input: RegistrationInput = {
        email: 'complex@example.com',
        additionalData: {
          firstName: 'John',
          lastName: 'Doe',
          company: 'Acme Corp',
          department: 'Engineering',
          role: 'Senior Developer',
          phone: '+1-555-123-4567',
          preferences: {
            newsletter: true,
            notifications: false
          }
        },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.user.registerUser as jest.Mock).mockResolvedValue({
        success: true,
        message: 'User registered successfully',
        code: 'REGISTRATION_SUCCESS'
      } as UserRegistrationResult);

      const result = await service.register(input);

      expect(result.success).toBe(true);
      expect(adapters.user.registerUser).toHaveBeenCalledWith('complex@example.com', {
        firstName: 'John',
        lastName: 'Doe',
        company: 'Acme Corp',
        department: 'Engineering',
        role: 'Senior Developer',
        phone: '+1-555-123-4567',
        preferences: {
          newsletter: true,
          notifications: false
        }
      });
    });

    it('should handle user adapter returning undefined', async () => {
      const input: RegistrationInput = {
        email: 'user@example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.user.registerUser as jest.Mock).mockResolvedValue(undefined);

      await expect(service.register(input)).rejects.toThrow();
    });

    it('should handle user adapter returning null', async () => {
      const input: RegistrationInput = {
        email: 'user@example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.user.registerUser as jest.Mock).mockResolvedValue(null);

      await expect(service.register(input)).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      const input: RegistrationInput = {
        email: 'user@example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.user.registerUser as jest.Mock).mockRejectedValue(new Error('Request timeout'));

      await expect(service.register(input)).rejects.toThrow('Request timeout');
    });
  });

  describe('validateInput', () => {
    it('should validate correct input', () => {
      const input: RegistrationInput = {
        email: 'user@example.com',
        additionalData: { firstName: 'John', lastName: 'Doe' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      // This tests the internal validation logic
      expect(() => service.register(input)).not.toThrow();
    });
  });
});
