/**
 * Base Magic Link Flow Handler
 * Abstract base class for all magic link flow implementations
 */

import { BaseCallbackFlowHandler } from './BaseCallbackFlowHandler';
import { OAuthConfig, OAuthAdapters, OAuthResult, OAUTH_ERROR_CODES } from '../types/OAuthTypes';
import { FLOW_PRIORITIES } from '../types/CallbackFlowTypes';
import { TokenManager } from '../core/TokenManager';
import { StateValidator } from '../core/StateValidator';
import { ErrorHandler } from '../utils/ErrorHandler';
import { UrlParser } from '../utils/UrlParser';

export abstract class BaseMagicLinkFlowHandler extends BaseCallbackFlowHandler {
  abstract readonly name: string;
  readonly priority = FLOW_PRIORITIES.HIGH; // Higher priority than standard OAuth

  /**
   * Check if this handler can process the given parameters
   * Subclasses should override this to add flow-specific checks
   */
  protected hasRequiredMagicLinkParams(params: URLSearchParams): boolean {
    return params.has('token') || params.has('magic_link_token');
  }

  /**
   * Check if this flow is disabled in config
   */
  protected isFlowDisabled(config: OAuthConfig): boolean {
    return config.flows?.disabledFlows?.includes(this.name) || false;
  }

  /**
   * Validate the magic link flow parameters
   */
  async validate(params: URLSearchParams, config: OAuthConfig): Promise<boolean> {
    try {
      // Check for OAuth errors first
      this.checkForOAuthError(params);

      // Check if this flow is disabled
      if (this.isFlowDisabled(config)) {
        return false;
      }

      // Must have either token or magic_link_token
      const hasToken = this.hasRequiredMagicLinkParams(params);
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
   * Handle the magic link flow - shared implementation for all magic link flows
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
  protected extractToken(params: URLSearchParams): string {
    const token = UrlParser.getFirstParam(params, ['token', 'magic_link_token']);

    if (!token) {
      throw ErrorHandler.handleMissingParameter('token or magic_link_token');
    }

    return token;
  }

  /**
   * Build additional parameters for token exchange
   */
  protected buildAdditionalParams(params: URLSearchParams, flow?: string): Record<string, string> {
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
  protected async validateState(state: string, adapters: OAuthAdapters): Promise<void> {
    const stateValidator = new StateValidator(adapters.storage);
    await stateValidator.validateStateOrThrow(state);
  }

  /**
   * Exchange magic link token for OAuth tokens
   */
  protected async exchangeMagicLinkToken(
    token: string,
    additionalParams: Record<string, string>,
    adapters: OAuthAdapters,
    config: OAuthConfig
  ): Promise<OAuthResult> {
    const tokenManager = new TokenManager(adapters.http, adapters.storage);
    return tokenManager.exchangeMagicLinkToken(token, config, additionalParams);
  }
}
