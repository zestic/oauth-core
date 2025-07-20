/**
 * Main OAuth orchestrator
 */

import { FlowRegistry } from './FlowRegistry';
import { PKCEManager } from './PKCEManager';
import { TokenManager } from './TokenManager';
import { StateValidator } from './StateValidator';
import {
  OAuthConfig,
  OAuthAdapters,
  OAuthResult,
  FlowConfiguration,
  OAUTH_ERROR_CODES
} from '../types/OAuthTypes';
import { FlowHandler } from '../types/FlowTypes';
import { ErrorHandler } from '../utils/ErrorHandler';
import { UrlParser } from '../utils/UrlParser';
import { AuthorizationCodeFlowHandler, MagicLinkFlowHandler } from '../flows';

export class OAuthCore {
  private flowRegistry: FlowRegistry;
  private pkceManager: PKCEManager;
  private tokenManager: TokenManager;
  private stateValidator: StateValidator;

  constructor(
    private config: OAuthConfig,
    private adapters: OAuthAdapters,
    flowConfig?: FlowConfiguration
  ) {
    this.flowRegistry = new FlowRegistry();
    this.pkceManager = new PKCEManager(adapters.pkce, adapters.storage);
    this.tokenManager = new TokenManager(adapters.http, adapters.storage);
    this.stateValidator = new StateValidator(adapters.storage);

    this.initializeFlows(flowConfig);
  }

  /**
   * Handle OAuth callback with automatic flow detection
   */
  async handleCallback(params: URLSearchParams | string, explicitFlow?: string): Promise<OAuthResult> {
    try {
      // Parse parameters if string provided
      const urlParams = typeof params === 'string' ? UrlParser.parseParams(params) : params;

      // Log callback attempt (with sanitized parameters)
      console.log('[OAuthCore] Handling callback:', UrlParser.sanitizeForLogging(urlParams));

      let handler: FlowHandler | undefined;

      // Try explicit flow first if specified
      if (explicitFlow) {
        handler = this.flowRegistry.getHandler(explicitFlow);
        if (!handler) {
          throw ErrorHandler.handleUnknownFlow(explicitFlow);
        }
      } else {
        // Auto-detect flow using registered handlers
        handler = this.flowRegistry.detectFlow(urlParams, this.config);
      }

      if (!handler) {
        throw ErrorHandler.handleNoFlowHandler();
      }

      console.log(`[OAuthCore] Using flow handler: ${handler.name}`);

      // Validate if handler supports validation
      if (handler.validate && !(await handler.validate(urlParams, this.config))) {
        throw ErrorHandler.handleFlowValidationFailed(handler.name);
      }

      // Handle the flow
      const result = await handler.handle(urlParams, this.adapters, this.config);

      console.log(`[OAuthCore] Flow ${handler.name} completed:`, {
        success: result.success,
        hasAccessToken: !!result.accessToken,
        hasRefreshToken: !!result.refreshToken,
      });

      return result;

    } catch (error) {
      console.error('[OAuthCore] Callback handling failed:', ErrorHandler.formatError(error));
      
      if (ErrorHandler.isOAuthError(error)) {
        throw error;
      }

      throw ErrorHandler.createError(
        `OAuth callback handling failed: ${error instanceof Error ? error.message : String(error)}`,
        OAUTH_ERROR_CODES.TOKEN_EXCHANGE_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate PKCE challenge for authorization request
   */
  async generatePKCEChallenge() {
    return this.pkceManager.generateChallenge();
  }

  /**
   * Generate OAuth state parameter
   */
  async generateState(): Promise<string> {
    const state = await this.pkceManager.generateState();
    await this.stateValidator.storeState(state);
    return state;
  }

  /**
   * Generate complete authorization URL with PKCE parameters
   * This method handles all OAuth logic including PKCE generation and state management
   */
  async generateAuthorizationUrl(additionalParams?: Record<string, string>): Promise<{
    url: string;
    state: string;
  }> {
    try {
      // Generate and store PKCE challenge
      const pkceChallenge = await this.generatePKCEChallenge();

      // Generate and store state
      const state = await this.generateState();

      // Build authorization URL parameters
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: this.config.clientId,
        redirect_uri: this.config.redirectUri,
        scope: this.config.scopes.join(' '),
        state,
        code_challenge: pkceChallenge.codeChallenge,
        code_challenge_method: pkceChallenge.codeChallengeMethod,
        ...additionalParams,
      });

      const url = `${this.config.endpoints.authorization}?${params.toString()}`;

      console.log('[OAuthCore] Generated authorization URL with PKCE parameters');

      return { url, state };

    } catch (error) {
      console.error('[OAuthCore] Failed to generate authorization URL:', ErrorHandler.formatError(error));

      throw ErrorHandler.createError(
        `Failed to generate authorization URL: ${error instanceof Error ? error.message : String(error)}`,
        OAUTH_ERROR_CODES.MISSING_PKCE,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get current access token
   */
  async getAccessToken(): Promise<string | null> {
    return this.tokenManager.getAccessToken();
  }

  /**
   * Get current refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    return this.tokenManager.getRefreshToken();
  }

  /**
   * Check if current token is expired
   */
  async isTokenExpired(): Promise<boolean> {
    return this.tokenManager.isTokenExpired();
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<OAuthResult> {
    const refreshToken = await this.tokenManager.getRefreshToken();
    
    if (!refreshToken) {
      throw ErrorHandler.createError(
        'No refresh token available',
        OAUTH_ERROR_CODES.MISSING_REQUIRED_PARAMETER
      );
    }

    return this.tokenManager.refreshToken(refreshToken, this.config);
  }

  /**
   * Revoke tokens and clear storage
   */
  async logout(): Promise<void> {
    await this.tokenManager.revokeTokens(this.config);
    await this.pkceManager.clearPKCEData();
    await this.stateValidator.clearState();
  }

  /**
   * Register a custom flow handler
   */
  registerFlow(handler: FlowHandler): void {
    this.flowRegistry.register(handler);
  }

  /**
   * Unregister a flow handler
   */
  unregisterFlow(name: string): void {
    this.flowRegistry.unregister(name);
  }

  /**
   * Get all registered flow handlers
   */
  getRegisteredFlows(): FlowHandler[] {
    return this.flowRegistry.getAllHandlers();
  }

  /**
   * Get compatible handlers for given parameters
   */
  getCompatibleHandlers(params: URLSearchParams | string): FlowHandler[] {
    const urlParams = typeof params === 'string' ? UrlParser.parseParams(params) : params;
    return this.flowRegistry.getCompatibleHandlers(urlParams, this.config);
  }

  /**
   * Initialize flow handlers based on configuration
   */
  private initializeFlows(flowConfig?: FlowConfiguration): void {
    // Register built-in flows first
    const builtInHandlers = [
      new AuthorizationCodeFlowHandler(),
      new MagicLinkFlowHandler(),
    ];

    for (const handler of builtInHandlers) {
      // Only register if not explicitly disabled
      if (!flowConfig?.disabledFlows?.includes(handler.name)) {
        this.flowRegistry.register(handler);
      }
    }

    // Register custom flows if provided
    if (flowConfig?.customFlows) {
      for (const handler of flowConfig.customFlows) {
        this.flowRegistry.register(handler);
      }
    }

    // If enabledFlows is specified, remove all others
    if (flowConfig?.enabledFlows) {
      const allHandlers = this.flowRegistry.getAllHandlers();
      
      for (const handler of allHandlers) {
        if (!flowConfig.enabledFlows.includes(handler.name)) {
          this.flowRegistry.unregister(handler.name);
        }
      }
    }

    // Validate that we have at least one flow handler
    if (this.flowRegistry.getHandlerCount() === 0) {
      throw ErrorHandler.handleInvalidConfiguration(
        'No flow handlers registered. At least one flow handler is required.'
      );
    }

    console.log('[OAuthCore] Initialized with flows:', this.flowRegistry.getHandlerNames());
  }
}
