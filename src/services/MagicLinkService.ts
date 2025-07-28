/**
 * Magic Link Service
 * Handles sending magic links via email with OAuth integration
 */

import { StateValidator } from '../core/StateValidator';
import { ErrorHandler } from '../utils/ErrorHandler';
import { OAUTH_ERROR_CODES } from '../types/OAuthTypes';
import type {
  SendMagicLinkInput,
  MagicLinkResponse,
  ExtendedOAuthAdapters,
  MagicLinkConfig,
  MagicLinkToken,
  ServiceResult
} from '../types/ServiceTypes';

export class MagicLinkService {
  private stateValidator: StateValidator;

  constructor(
    private adapters: ExtendedOAuthAdapters,
    private config: MagicLinkConfig
  ) {
    this.stateValidator = new StateValidator(adapters.storage);
  }

  /**
   * Send a magic link to the specified email address
   */
  async sendMagicLink(input: SendMagicLinkInput): Promise<MagicLinkResponse> {
    try {
      // Validate input
      this.validateMagicLinkInput(input);

      // Check if user exists (optional - depends on your use case)
      const userExists = await this.adapters.user.userExists(input.email);
      if (!userExists) {
        // You might want to handle this differently based on your security requirements
        // For now, we'll proceed to avoid user enumeration attacks
      }

      // Store PKCE challenge for later use in OAuth flow
      await this.storePKCEChallenge(input);

      // Store and validate state
      await this.stateValidator.storeState(input.state);

      // Generate magic link token
      const magicLinkToken = await this.generateMagicLinkToken(input);

      // Store magic link token with expiration
      await this.storeMagicLinkToken(magicLinkToken);

      // Build magic link URL
      const magicLinkUrl = this.buildMagicLinkUrl(magicLinkToken);

      // Trigger server-side magic link sending via GraphQL
      const graphqlResult = await this.adapters.graphql.sendMagicLinkMutation(
        input.email,
        magicLinkUrl,
        {
          subject: 'Your Magic Link',
          templateData: {
            email: input.email,
            magicLinkUrl,
            expirationMinutes: this.config.expirationMinutes || 15
          }
        }
      );

      if (!graphqlResult.success) {
        return {
          success: false,
          message: graphqlResult.message || 'Failed to trigger magic link sending',
          code: 'GRAPHQL_MUTATION_FAILED'
        };
      }

      return {
        success: true,
        message: 'Magic link sent successfully',
        code: 'MAGIC_LINK_SENT'
      };

    } catch (error) {
      if (ErrorHandler.isOAuthError(error)) {
        throw error;
      }

      throw ErrorHandler.createError(
        `Magic link sending failed: ${error instanceof Error ? error.message : String(error)}`,
        OAUTH_ERROR_CODES.INVALID_CONFIGURATION,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validate magic link input parameters
   */
  private validateMagicLinkInput(input: SendMagicLinkInput): void {
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
   * Generate a magic link token
   */
  private async generateMagicLinkToken(input: SendMagicLinkInput): Promise<MagicLinkToken> {
    // Generate a secure random token
    const token = await this.generateSecureToken();
    
    const expirationMinutes = this.config.expirationMinutes || 15;
    const expiresAt = new Date(Date.now() + (expirationMinutes * 60 * 1000));

    return {
      token,
      email: input.email,
      expiresAt,
      state: input.state,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod,
      redirectUri: input.redirectUri
    };
  }

  /**
   * Generate a secure random token
   */
  private async generateSecureToken(): Promise<string> {
    // Use the PKCE adapter to generate a secure random string
    const pkceChallenge = await this.adapters.pkce.generateCodeChallenge();
    return pkceChallenge.codeVerifier; // Use the code verifier as our token
  }

  /**
   * Store magic link token with expiration
   */
  private async storeMagicLinkToken(magicLinkToken: MagicLinkToken): Promise<void> {
    const tokenKey = `magic_link_token:${magicLinkToken.token}`;
    const tokenData = JSON.stringify(magicLinkToken);
    
    await this.adapters.storage.setItem(tokenKey, tokenData);
    
    // Also store by email for potential cleanup/validation
    const emailKey = `magic_link_email:${magicLinkToken.email}`;
    await this.adapters.storage.setItem(emailKey, magicLinkToken.token);
  }

  /**
   * Store PKCE challenge for later use in OAuth flow
   */
  private async storePKCEChallenge(input: SendMagicLinkInput): Promise<void> {
    // Store the PKCE challenge data that will be needed during token exchange
    await this.adapters.storage.setItem('pkce_challenge', input.codeChallenge);
    await this.adapters.storage.setItem('pkce_method', input.codeChallengeMethod);
    await this.adapters.storage.setItem('pkce_state', input.state);
    await this.adapters.storage.setItem('pkce_redirect_uri', input.redirectUri);
  }

  /**
   * Build the magic link URL
   */
  private buildMagicLinkUrl(magicLinkToken: MagicLinkToken): string {
    const url = new URL(this.config.baseUrl);
    
    // Add magic link token
    url.searchParams.set('magic_link_token', magicLinkToken.token);
    
    // Add OAuth parameters
    url.searchParams.set('state', magicLinkToken.state);
    url.searchParams.set('redirect_uri', magicLinkToken.redirectUri);
    url.searchParams.set('flow', 'magic_link');
    
    // Add any custom parameters
    if (this.config.customParams) {
      Object.entries(this.config.customParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    return url.toString();
  }

  /**
   * Simple email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate and retrieve magic link token
   */
  async validateMagicLinkToken(token: string): Promise<ServiceResult<MagicLinkToken>> {
    try {
      const tokenKey = `magic_link_token:${token}`;
      const tokenData = await this.adapters.storage.getItem(tokenKey);
      
      if (!tokenData) {
        return {
          success: false,
          error: 'Invalid or expired magic link token',
          code: 'INVALID_TOKEN'
        };
      }

      const magicLinkToken: MagicLinkToken = JSON.parse(tokenData);

      // Convert expiresAt string back to Date object
      magicLinkToken.expiresAt = new Date(magicLinkToken.expiresAt);

      // Check if token is expired
      if (new Date() > magicLinkToken.expiresAt) {
        // Clean up expired token
        await this.adapters.storage.removeItem(tokenKey);
        await this.adapters.storage.removeItem(`magic_link_email:${magicLinkToken.email}`);
        
        return {
          success: false,
          error: 'Magic link token has expired',
          code: 'TOKEN_EXPIRED'
        };
      }

      return {
        success: true,
        data: magicLinkToken,
        message: 'Token is valid'
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: 'Failed to validate magic link token'
      };
    }
  }
}

/**
 * Factory function to create magic link service
 */
export function createMagicLinkService(
  adapters: ExtendedOAuthAdapters,
  config: MagicLinkConfig
): MagicLinkService {
  return new MagicLinkService(adapters, config);
}
