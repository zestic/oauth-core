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
  FlowConfiguration
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
import {
  OAuthError,
  TokenError,
  ValidationError,
  FlowError,
  ErrorFactory
} from '../errors';
import { LoadingManager, AuthStatusManager } from '../state';
import { TokenScheduler, TokenUtils } from '../token';
import { ConfigValidator } from '../validation';

export class OAuthCore implements OAuthEventEmitter {
  private flowRegistry: CallbackFlowRegistry;
  private pkceManager: PKCEManager;
  private tokenManager: TokenManager;
  private stateValidator: StateValidator;
  private eventEmitter: EventEmitter<OAuthEventMap>;
  private loadingManager: LoadingManager;
  private tokenScheduler: TokenScheduler;
  private authStatusManager: AuthStatusManager;

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
    this.loadingManager = new LoadingManager(this.eventEmitter, {
      maxConcurrentOperations: 50,
      warnOnLongOperations: true,
      longOperationThresholdMs: 30000 // 30 seconds
    });
    this.tokenScheduler = new TokenScheduler(this.eventEmitter, {
      minRefreshDelayMs: 1000, // 1 second minimum
      maxRefreshDelayMs: 86400000, // 24 hours maximum
    });
    // Validate configuration early
    const validationResult = ConfigValidator.validate(config);
    if (!validationResult.valid) {
      console.warn('OAuthCore: Configuration validation failed:', validationResult.errors);
      // In pre-release mode, we continue but log warnings
      // Emit config validation event for any listeners
      this.eventEmitter?.emit('configValidation', {
        valid: false,
        errors: validationResult.errors.map(e => e.message),
        warnings: validationResult.warnings.map(w => w.message)
      });
    }

    this.authStatusManager = new AuthStatusManager(this.eventEmitter, {
      emitEvents: true,
      initialStatus: 'unauthenticated'
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
    return this.authStatusManager.status;
  }

  get isAuthenticated(): boolean {
    return this.authStatusManager.isAuthenticated;
  }

  get isLoading(): boolean {
    return this.loadingManager.isLoading;
  }

  get activeOperationsList(): string[] {
    return this.loadingManager.getActiveOperations();
  }

  /**
   * Check if a specific operation is currently active
   */
  isOperationActive(operation: string): boolean {
    return this.loadingManager.isOperationActive(operation);
  }

  /**
   * Get context for a specific active operation
   */
  getOperationContext(operation: string): LoadingContext | undefined {
    return this.loadingManager.getOperationContext(operation);
  }

  /**
   * Get loading manager statistics
   */
  getLoadingStatistics() {
    return this.loadingManager.getStatistics();
  }

  // Private helper methods
  private setAuthStatus(status: AuthStatus): void {
    this.authStatusManager.setStatus(status);
  }

  private startOperation(operation: string, metadata?: Record<string, unknown>): LoadingContext {
    return this.loadingManager.startOperation(operation, metadata);
  }

  private endOperation(context: LoadingContext, success: boolean): void {
    this.loadingManager.endOperation(context, success);
  }

  private createAuthSuccessData(result: OAuthResult, flowName?: string): AuthSuccessData {
    return {
      success: result.success,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      error: result.error,
      errorCode: result.errorCode,
      metadata: result.metadata ? {
        requestId: result.metadata.requestId,
        timestamp: result.metadata.timestamp,
        duration: result.metadata.duration,
        retryCount: result.metadata.retryCount,
        rateLimitRemaining: result.metadata.rateLimitRemaining,
        rateLimitReset: result.metadata.rateLimitReset
      } : undefined,
      flowName
    };
  }

  private createAuthErrorData(error: Error, operation?: string, retryCount?: number): AuthErrorData {
    let oauthError: OAuthError;

    if (OAuthError.isOAuthError(error)) {
      oauthError = error;
    } else {
      // Convert generic Error to structured OAuthError
      oauthError = ErrorFactory.fromError(
        error,
        'auth',
        'TOKEN_ERROR',
        this.isRecoverableError(error)
      );
    }

    // Add operation and retry count to metadata
    if (operation || retryCount !== undefined) {
      oauthError = oauthError.withContext({
        operation,
        retryCount
      });
    }

    return {
      error: oauthError,
      operation,
      recoverable: oauthError.canRetry(),
      retryCount
    };
  }

  private isRecoverableError(error: Error): boolean {
    if (ErrorHandler.isOAuthError(error)) {
      return [
        'NETWORK_ERROR',
        'TOKEN_ERROR'
      ].includes(error.code);
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
    const startTime = Date.now();
    const retryCount = 0; // Initialize retry count (will be used for future retry logic)

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
        const duration = Date.now() - startTime;
        const authSuccessData = this.createAuthSuccessData(result, handler.name);
        this.emit('authSuccess', authSuccessData);
        this.emit('callbackComplete', result, handler.name, duration);

        // Emit token events if tokens are present
        if (result.accessToken) {
          const tokens: OAuthTokens = {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresIn: result.expiresIn,
            tokenType: 'Bearer',
            issuedAt: new Date()
          };

          // Store complete token metadata
          await this.adapters.storage.setTokenData('oauth_tokens', tokens);
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

      // Add metadata to result before returning
      const endTime = Date.now();
      result.metadata = {
        requestId: `oauth-callback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(startTime),
        duration: endTime - startTime,
        retryCount
      };

      this.endOperation(loadingContext, result.success);
      return result;

    } catch (error) {
      console.error('[OAuthCore] Callback handling failed:', error);

      this.setAuthStatus('error');
      this.endOperation(loadingContext, false);

      const normalizedError = error instanceof Error ? error : new Error(String(error));
      const authErrorData = this.createAuthErrorData(
        normalizedError,
        OAUTH_OPERATIONS.HANDLE_CALLBACK
      );
      this.emit('authError', authErrorData);

      // If it's already a structured OAuth error, re-throw it
      if (OAuthError.isOAuthError(error)) {
        throw error;
      }

      // Create a structured flow error for callback handling failures
      throw FlowError.executionFailed(
        'callback_handling',
        normalizedError,
        true // Callback failures are retryable
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
      console.error('[OAuthCore] Failed to generate authorization URL:', error);

      this.endOperation(loadingContext, false);
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      const authErrorData = this.createAuthErrorData(
        normalizedError,
        OAUTH_OPERATIONS.GENERATE_AUTH_URL
      );
      this.emit('authError', authErrorData);

      // If it's already a structured OAuth error, re-throw it
      if (OAuthError.isOAuthError(error)) {
        throw error;
      }

      // Create a structured validation error for URL generation failures
      throw ValidationError.missingRequiredParameter('pkce_parameters');
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
   * Get the expiration time of current tokens
   * @returns Date when tokens expire, or null if expiration cannot be determined
   */
  async getTokenExpirationTime(): Promise<Date | null> {
    try {
      const tokenData = await this.adapters.storage.getTokenData('oauth_tokens');
      if (!tokenData) {
        return null;
      }

      return TokenUtils.getExpirationTime(tokenData);
    } catch (error) {
      console.warn('Failed to get token expiration time:', error);
      return null;
    }
  }

  /**
   * Get time until current token expires (in milliseconds)
   * @returns milliseconds until expiration, or Number.MAX_SAFE_INTEGER if unknown
   */
  async getTimeUntilTokenExpiration(): Promise<number> {
    try {
      const tokenData = await this.adapters.storage.getTokenData('oauth_tokens');
      if (!tokenData) {
        return Number.MAX_SAFE_INTEGER;
      }

      return TokenUtils.getTimeUntilExpiration(tokenData);
    } catch (error) {
      console.warn('Failed to get time until token expiration:', error);
      return Number.MAX_SAFE_INTEGER;
    }
  }

  /**
   * Schedule automatic token refresh
   * @param bufferMs Buffer time before expiration to trigger refresh (default: 5 minutes)
   * @returns Function to cancel the scheduled refresh
   */
  async scheduleTokenRefresh(bufferMs: number = 300000): Promise<() => void> {
    try {
      const tokenData = await this.adapters.storage.getTokenData('oauth_tokens');
      if (!tokenData) {
        console.warn('scheduleTokenRefresh: No token data available for scheduling');
        return () => {};
      }

      return this.tokenScheduler.scheduleRefresh(
        tokenData,
        bufferMs,
        async () => {
          console.log('TokenScheduler: Executing scheduled refresh');
          try {
            await this.refreshAccessToken();
          } catch (error) {
            console.error('Scheduled token refresh failed:', error);
            throw error;
          }
        }
      );
    } catch (error) {
      console.warn('scheduleTokenRefresh: Failed to schedule refresh:', error);
      return () => {};
    }
  }

  /**
   * Check if a token refresh is currently scheduled
   */
  isTokenRefreshScheduled(): boolean {
    return this.tokenScheduler.isRefreshScheduled();
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<OAuthResult> {
    const loadingContext = this.startOperation(OAUTH_OPERATIONS.REFRESH_TOKEN);
    this.setAuthStatus('refreshing');
    const startTime = Date.now();
    const retryCount = 0; // Initialize retry count (will be used for future retry logic)

    try {
      const refreshToken = await this.tokenManager.getRefreshToken();

      if (!refreshToken) {
        throw TokenError.refreshTokenMissing();
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
            tokenType: 'Bearer',
            issuedAt: new Date()
          };

          // Store updated token metadata
          await this.adapters.storage.setTokenData('oauth_tokens', tokens);
          this.emit('tokenRefresh', tokens);
          this.emit('tokensStored', tokens);

          // Auto-schedule next refresh
          this.scheduleTokenRefresh().catch(error => {
            console.warn('Failed to schedule token refresh after successful refresh:', error);
          });
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

      // Add metadata to result before returning
      const endTime = Date.now();
      result.metadata = {
        requestId: `oauth-refresh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(startTime),
        duration: endTime - startTime,
        retryCount
      };

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
      await this.adapters.storage.removeTokenData('oauth_tokens');

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

  /**
   * Cleanup resources when OAuthCore instance is no longer needed
   * This will cancel all active operations and cleanup the loading manager
   */
  destroy(): void {
    this.tokenScheduler.destroy();
    this.loadingManager.destroy();
    this.eventEmitter.removeAllListeners();
    // AuthStatusManager doesn't need explicit cleanup
  }
}
