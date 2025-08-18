/**
 * Main OAuth orchestrator with event-driven architecture
 */

import { CallbackFlowRegistry } from './CallbackFlowRegistry';
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
import { CallbackFlowHandler } from '../types/CallbackFlowTypes';
import { ErrorHandler } from '../utils/ErrorHandler';
import { UrlParser } from '../utils/UrlParser';
import { EventEmitter } from '../events/EventEmitter';
import {
  OAuthEventMap,
  OAuthEventEmitter,
  AuthStatus,
  LoadingContext,
  AuthSuccessData,
  AuthErrorData,
  LogoutData,
  OAUTH_OPERATIONS,
  OAuthTokens
} from '../events/OAuthEvents';

export class OAuthCore implements OAuthEventEmitter {
  private flowRegistry: CallbackFlowRegistry;
  private pkceManager: PKCEManager;
  private tokenManager: TokenManager;
  private stateValidator: StateValidator;
  private eventEmitter: EventEmitter<OAuthEventMap>;
  private currentAuthStatus: AuthStatus = 'unauthenticated';
  private activeOperations = new Set<string>();

  constructor(
    private config: OAuthConfig,
    private adapters: OAuthAdapters,
    flowConfig?: FlowConfiguration
  ) {
    this.flowRegistry = new CallbackFlowRegistry();
    this.pkceManager = new PKCEManager(adapters.pkce, adapters.storage);
    this.tokenManager = new TokenManager(adapters.http, adapters.storage);
    this.stateValidator = new StateValidator(adapters.storage);
    this.eventEmitter = new EventEmitter<OAuthEventMap>({
      maxListeners: 50, // Allow more listeners for complex applications
      warnOnMaxListeners: true
    });

    this.initializeFlows(flowConfig);
    this.initializeAuthStatus();
  }

  // Event emitter interface implementation
  on<TEvent extends keyof OAuthEventMap>(
    event: TEvent,
    callback: OAuthEventMap[TEvent]
  ): () => void {
    return this.eventEmitter.on(event, callback);
  }

  once<TEvent extends keyof OAuthEventMap>(
    event: TEvent,
    callback: OAuthEventMap[TEvent]
  ): () => void {
    return this.eventEmitter.once(event, callback);
  }

  off<TEvent extends keyof OAuthEventMap>(
    event: TEvent,
    callback: OAuthEventMap[TEvent]
  ): void {
    this.eventEmitter.off(event, callback);
  }

  emit<TEvent extends keyof OAuthEventMap>(
    event: TEvent,
    ...args: Parameters<OAuthEventMap[TEvent]>
  ): boolean {
    return this.eventEmitter.emit(event, ...args);
  }

  removeAllListeners(event?: keyof OAuthEventMap): void {
    this.eventEmitter.removeAllListeners(event);
  }

  listenerCount(event: keyof OAuthEventMap): number {
    return this.eventEmitter.listenerCount(event);
  }

  hasListeners(event?: keyof OAuthEventMap): boolean {
    return this.eventEmitter.hasListeners(event);
  }

  // Public getters for state
  get authenticationStatus(): AuthStatus {
    return this.currentAuthStatus;
  }

  get isAuthenticated(): boolean {
    return this.currentAuthStatus === 'authenticated';
  }

  get isLoading(): boolean {
    return this.activeOperations.size > 0;
  }

  get activeOperationsList(): string[] {
    return Array.from(this.activeOperations);
  }

  // Private helper methods
  private setAuthStatus(status: AuthStatus): void {
    const previousStatus = this.currentAuthStatus;
    if (previousStatus !== status) {
      this.currentAuthStatus = status;
      this.emit('authStatusChange', status, previousStatus);
    }
  }

  private startOperation(operation: string, metadata?: Record<string, unknown>): LoadingContext {
    const context: LoadingContext = {
      operation,
      startTime: Date.now(),
      metadata
    };

    this.activeOperations.add(operation);
    this.emit('loadingStart', context);
    return context;
  }

  private endOperation(context: LoadingContext, success: boolean): void {
    const duration = Date.now() - context.startTime;
    this.activeOperations.delete(context.operation);
    this.emit('loadingEnd', { ...context, success, duration });
  }

  private createAuthSuccessData(result: OAuthResult, flowName?: string, duration?: number): AuthSuccessData {
    return {
      ...result,
      flowName,
      duration,
      metadata: {
        timestamp: new Date(),
        hasRefreshToken: !!result.refreshToken,
        expiresIn: result.expiresIn
      }
    };
  }

  private createAuthErrorData(error: Error, operation?: string, retryCount?: number): AuthErrorData {
    return {
      error: ErrorHandler.isOAuthError(error) ? error : ErrorHandler.createError(
        error.message,
        OAUTH_ERROR_CODES.TOKEN_EXCHANGE_FAILED,
        error
      ),
      operation,
      recoverable: this.isRecoverableError(error),
      retryCount
    };
  }

  private isRecoverableError(error: Error): boolean {
    if (ErrorHandler.isOAuthError(error)) {
      return [
        OAUTH_ERROR_CODES.NETWORK_ERROR,
        OAUTH_ERROR_CODES.TOKEN_EXCHANGE_FAILED
      ].includes(error.code as any);
    }
    return false;
  }

  private async initializeAuthStatus(): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();
      if (accessToken) {
        const isExpired = await this.isTokenExpired();
        this.setAuthStatus(isExpired ? 'expired' : 'authenticated');
      } else {
        this.setAuthStatus('unauthenticated');
      }
    } catch (error) {
      this.setAuthStatus('error');
    }
  }

  /**
   * Handle OAuth callback with automatic flow detection
   */
  async handleCallback(params: URLSearchParams | string, explicitFlow?: string): Promise<OAuthResult> {
    const loadingContext = this.startOperation(OAUTH_OPERATIONS.HANDLE_CALLBACK);
    this.setAuthStatus('authenticating');

    try {
      // Parse parameters if string provided
      const urlParams = typeof params === 'string' ? UrlParser.parseParams(params) : params;

      // Convert URLSearchParams to plain object for event emission
      const paramsObj: Record<string, string> = {};
      urlParams.forEach((value, key) => {
        paramsObj[key] = value;
      });

      // Emit callback start event
      this.emit('callbackStart', paramsObj, explicitFlow);

      // Log callback attempt (with sanitized parameters)
      console.log('[OAuthCore] Handling callback:', UrlParser.sanitizeForLogging(urlParams));

      // Validate that we have at least one flow handler registered
      if (this.flowRegistry.getHandlerCount() === 0) {
        throw ErrorHandler.handleInvalidConfiguration(
          'No flow handlers registered. Use registerFlow() to register at least one flow handler.'
        );
      }

      let handler: CallbackFlowHandler | undefined;

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

      // Emit flow detection event
      this.emit('flowDetected', handler.name, 1.0, 'Flow handler selected');

      console.log(`[OAuthCore] Using flow handler: ${handler.name}`);

      // Validate parameters before handling
      if (!(await handler.validate(urlParams, this.config))) {
        throw ErrorHandler.handleFlowValidationFailed(handler.name);
      }

      // Handle the flow
      const result = await handler.handle(urlParams, this.adapters, this.config);

      console.log(`[OAuthCore] Flow ${handler.name} completed:`, {
        success: result.success,
        hasAccessToken: !!result.accessToken,
        hasRefreshToken: !!result.refreshToken,
      });

      // Update auth status and emit events based on result
      if (result.success) {
        this.setAuthStatus('authenticated');
        const duration = Date.now() - loadingContext.startTime;
        const authSuccessData = this.createAuthSuccessData(result, handler.name, duration);
        this.emit('authSuccess', authSuccessData);
        this.emit('callbackComplete', result, handler.name, duration);

        // Emit token events if tokens are present
        if (result.accessToken) {
          const tokens: OAuthTokens = {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresIn: result.expiresIn,
            tokenType: 'Bearer'
          };
          this.emit('tokensStored', tokens);
        }
      } else {
        this.setAuthStatus('error');
        const authErrorData = this.createAuthErrorData(
          new Error(result.error || 'Authentication failed'),
          OAUTH_OPERATIONS.HANDLE_CALLBACK
        );
        this.emit('authError', authErrorData);
      }

      this.endOperation(loadingContext, result.success);
      return result;

    } catch (error) {
      console.error('[OAuthCore] Callback handling failed:', ErrorHandler.formatError(error));

      this.setAuthStatus('error');
      this.endOperation(loadingContext, false);

      const authErrorData = this.createAuthErrorData(
        error instanceof Error ? error : new Error(String(error)),
        OAUTH_OPERATIONS.HANDLE_CALLBACK
      );
      this.emit('authError', authErrorData);

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
    const challenge = await this.pkceManager.generateChallenge();
    this.emit('pkceGenerated', {
      codeChallenge: challenge.codeChallenge,
      codeChallengeMethod: challenge.codeChallengeMethod
    });
    return challenge;
  }

  /**
   * Generate OAuth state parameter
   */
  async generateState(): Promise<string> {
    const state = await this.pkceManager.generateState();
    await this.stateValidator.storeState(state);
    this.emit('stateGenerated', state);
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
    const loadingContext = this.startOperation(OAUTH_OPERATIONS.GENERATE_AUTH_URL);

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

      // Emit auth URL generated event
      this.emit('authUrlGenerated', url, state);
      this.endOperation(loadingContext, true);

      return { url, state };

    } catch (error) {
      console.error('[OAuthCore] Failed to generate authorization URL:', ErrorHandler.formatError(error));

      this.endOperation(loadingContext, false);
      const authErrorData = this.createAuthErrorData(
        error instanceof Error ? error : new Error(String(error)),
        OAUTH_OPERATIONS.GENERATE_AUTH_URL
      );
      this.emit('authError', authErrorData);

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
    const loadingContext = this.startOperation(OAUTH_OPERATIONS.REFRESH_TOKEN);
    this.setAuthStatus('refreshing');

    try {
      const refreshToken = await this.tokenManager.getRefreshToken();

      if (!refreshToken) {
        throw ErrorHandler.createError(
          'No refresh token available',
          OAUTH_ERROR_CODES.MISSING_REQUIRED_PARAMETER
        );
      }

      const result = await this.tokenManager.refreshToken(refreshToken, this.config);

      if (result.success) {
        this.setAuthStatus('authenticated');

        // Emit token refresh event
        if (result.accessToken) {
          const tokens: OAuthTokens = {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresIn: result.expiresIn,
            tokenType: 'Bearer'
          };
          this.emit('tokenRefresh', tokens);
          this.emit('tokensStored', tokens);
        }

        const authSuccessData = this.createAuthSuccessData(result, 'token_refresh');
        this.emit('authSuccess', authSuccessData);
      } else {
        this.setAuthStatus('error');
        const authErrorData = this.createAuthErrorData(
          new Error(result.error || 'Token refresh failed'),
          OAUTH_OPERATIONS.REFRESH_TOKEN
        );
        this.emit('authError', authErrorData);
      }

      this.endOperation(loadingContext, result.success);
      return result;

    } catch (error) {
      this.setAuthStatus('error');
      this.endOperation(loadingContext, false);

      const authErrorData = this.createAuthErrorData(
        error instanceof Error ? error : new Error(String(error)),
        OAUTH_OPERATIONS.REFRESH_TOKEN
      );
      this.emit('authError', authErrorData);

      throw error;
    }
  }

  /**
   * Revoke tokens and clear storage
   */
  async logout(reason: 'user' | 'expired' | 'error' | 'revoked' = 'user'): Promise<void> {
    const loadingContext = this.startOperation(OAUTH_OPERATIONS.REVOKE_TOKEN);

    try {
      await this.tokenManager.revokeTokens(this.config);
      await this.pkceManager.clearPKCEData();
      await this.stateValidator.clearState();

      this.setAuthStatus('unauthenticated');

      const logoutData: LogoutData = {
        reason,
        clearStorage: true
      };
      this.emit('logout', logoutData);
      this.emit('tokensCleared', `Logout: ${reason}`);

      this.endOperation(loadingContext, true);

    } catch (error) {
      this.endOperation(loadingContext, false);

      // Even if revocation fails, we still clear local storage and emit logout
      this.setAuthStatus('unauthenticated');
      const logoutData: LogoutData = {
        reason,
        clearStorage: true
      };
      this.emit('logout', logoutData);
      this.emit('tokensCleared', `Logout with error: ${reason}`);

      console.warn('Token revocation failed during logout:', error);
    }
  }

  /**
   * Register a custom flow handler
   */
  registerFlow(handler: CallbackFlowHandler): void {
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
  getRegisteredFlows(): CallbackFlowHandler[] {
    return this.flowRegistry.getAllHandlers();
  }

  /**
   * Get compatible handlers for given parameters
   */
  getCompatibleHandlers(params: URLSearchParams | string): CallbackFlowHandler[] {
    const urlParams = typeof params === 'string' ? UrlParser.parseParams(params) : params;
    return this.flowRegistry.getCompatibleHandlers(urlParams, this.config);
  }

  /**
   * Initialize flow handlers based on configuration
   */
  private initializeFlows(flowConfig?: FlowConfiguration): void {
    // No built-in flows are automatically registered
    // Users must manually register the specific flow handlers they need:
    // - MagicLinkLoginFlowHandler for login flows
    // - MagicLinkVerifyFlowHandler for verification flows

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

    // Note: Flow handlers must be manually registered after initialization
    // The validation will happen when handleCallback is called

    console.log('[OAuthCore] Initialized. Flow handlers must be registered manually.');
  }
}
