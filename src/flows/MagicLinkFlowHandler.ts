/**
 * Magic Link Flow Handler
 */

import { BaseFlowHandler } from './FlowHandler';
import { OAuthConfig, OAuthAdapters, OAuthResult, OAUTH_ERROR_CODES } from '../types/OAuthTypes';
import { FLOW_PRIORITIES } from '../types/FlowTypes';
import { TokenManager } from '../core/TokenManager';
import { StateValidator } from '../core/StateValidator';
import { ErrorHandler } from '../utils/ErrorHandler';
import { UrlParser } from '../utils/UrlParser';

export class MagicLinkFlowHandler extends BaseFlowHandler {
  readonly name = 'magic_link';
  readonly priority = FLOW_PRIORITIES.HIGH; // Higher priority than standard OAuth

  /**
   * Check if this handler can process the given parameters
   */
  canHandle(params: URLSearchParams): boolean {
    // Magic link flow requires either 'token' or 'magic_link_token' parameter
    return params.has('token') || params.has('magic_link_token');
  }

  /**
   * Validate the magic link flow parameters
   */
  async validate(params: URLSearchParams): Promise<boolean> {
    try {
      // Check for OAuth errors first
      this.checkForOAuthError(params);

      // Must have either token or magic_link_token
      const hasToken = params.has('token') || params.has('magic_link_token');
      if (!hasToken) {
        return false;
      }

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
   * Handle the magic link flow
   */
  async handle(params: URLSearchParams, adapters: OAuthAdapters, config: OAuthConfig): Promise<OAuthResult> {
    this.logFlowExecution('Starting magic link flow', params);

    return this.measureExecutionTime(async () => {
      try {
        // Check for OAuth errors
        this.checkForOAuthError(params);

        // Extract token (try both parameter names)
        const token = this.extractToken(params);
        const flow = this.getOptionalParam(params, 'flow');
        const state = this.getOptionalParam(params, 'state');

        // Validate state if present
        if (state) {
          await this.validateState(state, adapters);
        }

        // Build additional parameters for the token exchange
        const additionalParams = this.buildAdditionalParams(params, flow);

        // Exchange magic link token for OAuth tokens
        const result = await this.exchangeMagicLinkToken(token, additionalParams, adapters, config);

        this.logFlowExecution('Magic link flow completed successfully');
        return result;

      } catch (error) {
        this.logFlowExecution(`Magic link flow failed: ${ErrorHandler.formatError(error)}`);
        
        if (ErrorHandler.isOAuthError(error)) {
          throw error;
        }

        throw ErrorHandler.createError(
          `Magic link flow failed: ${error instanceof Error ? error.message : String(error)}`,
          OAUTH_ERROR_CODES.TOKEN_EXCHANGE_FAILED,
          error instanceof Error ? error : undefined
        );
      }
    }, 'Magic link token exchange');
  }

  /**
   * Extract token from parameters (supports both 'token' and 'magic_link_token')
   */
  private extractToken(params: URLSearchParams): string {
    const token = UrlParser.getFirstParam(params, ['token', 'magic_link_token']);
    
    if (!token) {
      throw ErrorHandler.handleMissingParameter('token or magic_link_token');
    }

    return token;
  }

  /**
   * Build additional parameters for token exchange
   */
  private buildAdditionalParams(params: URLSearchParams, flow?: string): Record<string, string> {
    const additionalParams: Record<string, string> = {};

    // Include flow type if specified
    if (flow) {
      additionalParams.flow = flow;
    }

    // Include any PKCE parameters that might be present
    const codeChallenge = params.get('code_challenge');
    const codeChallengeMethod = params.get('code_challenge_method');
    const codeVerifier = params.get('code_verifier');
    const state = params.get('state');

    if (codeChallenge) {
      additionalParams.code_challenge = codeChallenge;
    }

    if (codeChallengeMethod) {
      additionalParams.code_challenge_method = codeChallengeMethod;
    }

    if (codeVerifier) {
      additionalParams.code_verifier = codeVerifier;
    }

    if (state) {
      additionalParams.state = state;
    }

    return additionalParams;
  }

  /**
   * Validate state parameter
   */
  private async validateState(state: string, adapters: OAuthAdapters): Promise<void> {
    const stateValidator = new StateValidator(adapters.storage);
    await stateValidator.validateStateOrThrow(state);
  }

  /**
   * Exchange magic link token for OAuth tokens
   */
  private async exchangeMagicLinkToken(
    token: string,
    additionalParams: Record<string, string>,
    adapters: OAuthAdapters,
    config: OAuthConfig
  ): Promise<OAuthResult> {
    const tokenManager = new TokenManager(adapters.http, adapters.storage);
    return tokenManager.exchangeMagicLinkToken(token, config, additionalParams);
  }
}

/**
 * Factory function to create magic link flow handler
 */
export function createMagicLinkFlowHandler(): MagicLinkFlowHandler {
  return new MagicLinkFlowHandler();
}

/**
 * Specialized handlers for different magic link flows
 */
export class MagicLinkLoginFlowHandler extends BaseFlowHandler {
  readonly name = 'magic_link_login';
  readonly priority = FLOW_PRIORITIES.HIGH;

  canHandle(params: URLSearchParams): boolean {
    const hasToken = params.has('token') || params.has('magic_link_token');
    const flow = params.get('flow');
    return hasToken && flow === 'login';
  }

  async handle(params: URLSearchParams, adapters: OAuthAdapters, config: OAuthConfig): Promise<OAuthResult> {
    const handler = new MagicLinkFlowHandler();
    return handler.handle(params, adapters, config);
  }
}

export class MagicLinkRegistrationFlowHandler extends BaseFlowHandler {
  readonly name = 'magic_link_registration';
  readonly priority = FLOW_PRIORITIES.HIGH;

  canHandle(params: URLSearchParams): boolean {
    const hasToken = params.has('token') || params.has('magic_link_token');
    const flow = params.get('flow');
    return hasToken && flow === 'registration';
  }

  async handle(params: URLSearchParams, adapters: OAuthAdapters, config: OAuthConfig): Promise<OAuthResult> {
    const handler = new MagicLinkFlowHandler();
    return handler.handle(params, adapters, config);
  }
}

/**
 * Factory functions for specialized handlers
 */
export function createMagicLinkLoginFlowHandler(): MagicLinkLoginFlowHandler {
  return new MagicLinkLoginFlowHandler();
}

export function createMagicLinkRegistrationFlowHandler(): MagicLinkRegistrationFlowHandler {
  return new MagicLinkRegistrationFlowHandler();
}
