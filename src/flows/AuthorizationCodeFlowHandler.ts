/**
 * OAuth2 Authorization Code Flow Handler
 */

import { BaseFlowHandler } from './FlowHandler';
import { OAuthConfig, OAuthAdapters, OAuthResult, OAUTH_ERROR_CODES } from '../types/OAuthTypes';
import { FLOW_PRIORITIES } from '../types/FlowTypes';
import { PKCEManager } from '../core/PKCEManager';
import { TokenManager } from '../core/TokenManager';
import { StateValidator } from '../core/StateValidator';
import { ErrorHandler } from '../utils/ErrorHandler';

export class AuthorizationCodeFlowHandler extends BaseFlowHandler {
  readonly name = 'authorization_code';
  readonly priority = FLOW_PRIORITIES.NORMAL; // Standard OAuth flow

  /**
   * Check if this handler can process the given parameters
   */
  canHandle(params: URLSearchParams): boolean {
    // Authorization code flow requires 'code' parameter
    // and should NOT have magic link tokens
    return (
      params.has('code') &&
      !params.has('token') &&
      !params.has('magic_link_token')
    );
  }

  /**
   * Validate the authorization code flow parameters
   */
  override async validate(params: URLSearchParams): Promise<boolean> {
    try {
      // Check for OAuth errors first
      this.checkForOAuthError(params);

      // Validate required parameters
      this.validateRequiredParams(params, ['code']);

      // If state is present, validate it
      const state = params.get('state');
      if (state) {
        // Note: In real usage, adapters would be passed from the handle method
        // For validation, we just check if state exists
        return true;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Handle the authorization code flow
   */
  async handle(params: URLSearchParams, adapters: OAuthAdapters, config: OAuthConfig): Promise<OAuthResult> {
    this.logFlowExecution('Starting authorization code flow', params);

    return this.measureExecutionTime(async () => {
      try {
        // Check for OAuth errors
        this.checkForOAuthError(params);

        // Extract required parameters
        const code = this.getRequiredParam(params, 'code');
        const state = this.getOptionalParam(params, 'state');

        // Validate state if present
        if (state) {
          await this.validateState(state, adapters);
        }

        // Get stored PKCE code verifier
        const codeVerifier = await this.getCodeVerifier(adapters);

        // Exchange authorization code for tokens
        const result = await this.exchangeCodeForTokens(code, codeVerifier, adapters, config);

        // Clean up stored PKCE data
        await this.cleanupPKCEData(adapters);

        this.logFlowExecution('Authorization code flow completed successfully');
        return result;

      } catch (error) {
        this.logFlowExecution(`Authorization code flow failed: ${ErrorHandler.formatError(error)}`);
        
        if (ErrorHandler.isOAuthError(error)) {
          throw error;
        }

        throw ErrorHandler.createError(
          `Authorization code flow failed: ${error instanceof Error ? error.message : String(error)}`,
          OAUTH_ERROR_CODES.TOKEN_EXCHANGE_FAILED,
          error instanceof Error ? error : undefined
        );
      }
    }, 'Authorization code exchange');
  }

  /**
   * Validate state parameter
   */
  private async validateState(state: string, adapters: OAuthAdapters): Promise<void> {
    const stateValidator = new StateValidator(adapters.storage);
    await stateValidator.validateStateOrThrow(state);
  }

  /**
   * Get stored PKCE code verifier
   */
  private async getCodeVerifier(adapters: OAuthAdapters): Promise<string> {
    const pkceManager = new PKCEManager(adapters.pkce, adapters.storage);
    const codeVerifier = await pkceManager.getCodeVerifier();

    if (!codeVerifier) {
      throw ErrorHandler.createError(
        'PKCE code verifier not found in storage',
        OAUTH_ERROR_CODES.MISSING_PKCE
      );
    }

    return codeVerifier;
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    adapters: OAuthAdapters,
    config: OAuthConfig
  ): Promise<OAuthResult> {
    const tokenManager = new TokenManager(adapters.http, adapters.storage);
    return tokenManager.exchangeAuthorizationCode(code, codeVerifier, config);
  }

  /**
   * Clean up stored PKCE data after successful exchange
   */
  private async cleanupPKCEData(adapters: OAuthAdapters): Promise<void> {
    try {
      const pkceManager = new PKCEManager(adapters.pkce, adapters.storage);
      await pkceManager.clearPKCEData();
    } catch (error) {
      // Log cleanup error but don't fail the flow
      console.warn('Failed to cleanup PKCE data:', error);
    }
  }
}

/**
 * Factory function to create authorization code flow handler
 */
export function createAuthorizationCodeFlowHandler(): AuthorizationCodeFlowHandler {
  return new AuthorizationCodeFlowHandler();
}
