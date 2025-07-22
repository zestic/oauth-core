/**
 * Registration Service
 * Handles user registration with OAuth integration
 */

import { StateValidator } from '../core/StateValidator';
import { ErrorHandler } from '../utils/ErrorHandler';
import { OAUTH_ERROR_CODES } from '../types/OAuthTypes';
import type {
  RegistrationInput,
  RegistrationResponse,
  ExtendedOAuthAdapters,
  ServiceResult
} from '../types/ServiceTypes';

export class RegistrationService {
  private stateValidator: StateValidator;

  constructor(private adapters: ExtendedOAuthAdapters) {
    this.stateValidator = new StateValidator(adapters.storage);
  }

  /**
   * Register a new user with OAuth integration
   */
  async register(input: RegistrationInput): Promise<RegistrationResponse> {
    try {
      // Validate input
      this.validateRegistrationInput(input);

      // Check if user already exists
      const userExists = await this.adapters.user.userExists(input.email);
      if (userExists) {
        return {
          success: false,
          message: 'User already exists with this email address',
          code: 'USER_EXISTS'
        };
      }

      // Store PKCE challenge for later use in OAuth flow
      await this.storePKCEChallenge(input);

      // Store and validate state
      await this.stateValidator.storeState(input.state);

      // Register the user
      const registrationResult = await this.adapters.user.registerUser(
        input.email,
        input.additionalData
      );

      if (!registrationResult.success) {
        return {
          success: false,
          message: registrationResult.message || 'Registration failed',
          code: 'REGISTRATION_FAILED'
        };
      }

      // Send registration confirmation email if available
      try {
        await this.adapters.email.sendRegistrationConfirmation(input.email, {
          subject: 'Registration Successful',
          templateData: {
            email: input.email,
            redirectUri: input.redirectUri
          }
        });
      } catch (emailError) {
        // Log email error but don't fail the registration
        console.warn('Failed to send registration confirmation email:', emailError);
      }

      return {
        success: true,
        message: 'User registered successfully',
        code: 'REGISTRATION_SUCCESS'
      };

    } catch (error) {
      if (ErrorHandler.isOAuthError(error)) {
        throw error;
      }

      throw ErrorHandler.createError(
        `Registration failed: ${error instanceof Error ? error.message : String(error)}`,
        OAUTH_ERROR_CODES.INVALID_CONFIGURATION,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validate registration input parameters
   */
  private validateRegistrationInput(input: RegistrationInput): void {
    if (!input.email || typeof input.email !== 'string') {
      throw ErrorHandler.handleMissingParameter('email');
    }

    if (!this.isValidEmail(input.email)) {
      throw ErrorHandler.createError(
        'Invalid email format',
        OAUTH_ERROR_CODES.MISSING_REQUIRED_PARAMETER
      );
    }

    if (!input.codeChallenge || typeof input.codeChallenge !== 'string') {
      throw ErrorHandler.handleMissingParameter('codeChallenge');
    }

    if (!input.codeChallengeMethod || typeof input.codeChallengeMethod !== 'string') {
      throw ErrorHandler.handleMissingParameter('codeChallengeMethod');
    }

    if (!input.redirectUri || typeof input.redirectUri !== 'string') {
      throw ErrorHandler.handleMissingParameter('redirectUri');
    }

    if (!input.state || typeof input.state !== 'string') {
      throw ErrorHandler.handleMissingParameter('state');
    }

    if (!input.additionalData || typeof input.additionalData !== 'object') {
      throw ErrorHandler.handleMissingParameter('additionalData');
    }

    // Validate PKCE method
    if (!['S256', 'plain'].includes(input.codeChallengeMethod)) {
      throw ErrorHandler.createError(
        'Invalid code challenge method. Must be S256 or plain',
        OAUTH_ERROR_CODES.MISSING_PKCE
      );
    }

    // Validate redirect URI format
    try {
      new URL(input.redirectUri);
    } catch {
      throw ErrorHandler.createError(
        'Invalid redirect URI format',
        OAUTH_ERROR_CODES.INVALID_CONFIGURATION
      );
    }
  }

  /**
   * Store PKCE challenge for later use in OAuth flow
   */
  private async storePKCEChallenge(input: RegistrationInput): Promise<void> {
    // Store using the same keys that PKCEManager uses
    await this.adapters.storage.setItem('pkce_challenge', input.codeChallenge);
    await this.adapters.storage.setItem('pkce_method', input.codeChallengeMethod);
    await this.adapters.storage.setItem('pkce_state', input.state);
    await this.adapters.storage.setItem('pkce_redirect_uri', input.redirectUri);
  }

  /**
   * Simple email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get registration status for a user
   */
  async getRegistrationStatus(email: string): Promise<ServiceResult<{ exists: boolean; user?: unknown }>> {
    try {
      const userExists = await this.adapters.user.userExists(email);
      
      if (userExists) {
        const user = await this.adapters.user.getUserByEmail(email);
        return {
          success: true,
          data: { exists: true, user },
          message: 'User found'
        };
      }

      return {
        success: true,
        data: { exists: false },
        message: 'User not found'
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: 'Failed to check registration status'
      };
    }
  }
}

/**
 * Factory function to create registration service
 */
export function createRegistrationService(adapters: ExtendedOAuthAdapters): RegistrationService {
  return new RegistrationService(adapters);
}
