/**
 * OAuth-specific event types and interfaces
 */

import type { OAuthResult, OAuthError } from '../types/OAuthTypes';

/**
 * Authentication status enumeration
 */
export type AuthStatus = 
  | 'unauthenticated' 
  | 'authenticating' 
  | 'authenticated' 
  | 'refreshing' 
  | 'expired'
  | 'error';

/**
 * OAuth tokens interface for events
 */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
  issuedAt?: Date;
}

/**
 * Loading operation context
 */
export interface LoadingContext {
  operation: string;
  startTime: number;
  metadata?: Record<string, unknown>;
}

/**
 * Token expiration event data
 */
export interface TokenExpirationData {
  tokens: OAuthTokens;
  expiredAt: Date;
  timeUntilExpiration: number;
}

/**
 * Auth success event data
 */
export interface AuthSuccessData {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
  errorCode?: string;
  metadata?: {
    requestId?: string;
    timestamp: Date;
    duration: number;
    retryCount?: number;
    rateLimitRemaining?: number;
    rateLimitReset?: Date;
  };
  flowName?: string;
}

/**
 * Auth error event data
 */
export interface AuthErrorData {
  error: OAuthError;
  operation?: string;
  recoverable?: boolean;
  retryCount?: number;
}

/**
 * Logout event data
 */
export interface LogoutData {
  reason?: 'user' | 'expired' | 'error' | 'revoked';
  clearStorage?: boolean;
}

/**
 * Configuration validation event data
 */
export interface ConfigValidationData {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * OAuth event map defining all available events and their callback signatures
 */
export interface OAuthEventMap {
  /**
   * Emitted when authentication status changes
   */
  'authStatusChange': (status: AuthStatus, previousStatus?: AuthStatus) => void;

  /**
   * Emitted when tokens are successfully refreshed
   */
  'tokenRefresh': (tokens: OAuthTokens) => void;

  /**
   * Emitted when tokens are about to expire or have expired
   */
  'tokenExpired': (data: TokenExpirationData) => void;

  /**
   * Emitted when token refresh is scheduled
   */
  'tokenRefreshScheduled': (scheduledAt: Date, bufferMs: number) => void;

  /**
   * Emitted when authentication succeeds
   */
  'authSuccess': (data: AuthSuccessData) => void;

  /**
   * Emitted when authentication fails
   */
  'authError': (data: AuthErrorData) => void;

  /**
   * Emitted when a loading operation starts
   */
  'loadingStart': (context: LoadingContext) => void;

  /**
   * Emitted when a loading operation ends
   */
  'loadingEnd': (context: LoadingContext & { success: boolean; duration: number }) => void;

  /**
   * Emitted when user logs out
   */
  'logout': (data: LogoutData) => void;

  /**
   * Emitted when configuration validation occurs
   */
  'configValidation': (data: ConfigValidationData) => void;

  /**
   * Emitted when PKCE challenge is generated
   */
  'pkceGenerated': (challenge: { codeChallenge: string; codeChallengeMethod: string }) => void;

  /**
   * Emitted when state parameter is generated
   */
  'stateGenerated': (state: string) => void;

  /**
   * Emitted when authorization URL is generated
   */
  'authUrlGenerated': (url: string, state: string) => void;

  /**
   * Emitted when callback handling starts
   */
  'callbackStart': (params: Record<string, string>, flowName?: string) => void;

  /**
   * Emitted when callback handling completes
   */
  'callbackComplete': (result: OAuthResult, flowName: string, duration: number) => void;

  /**
   * Emitted when flow detection occurs
   */
  'flowDetected': (flowName: string, confidence: number, reason: string) => void;

  /**
   * Emitted when tokens are stored
   */
  'tokensStored': (tokens: OAuthTokens) => void;

  /**
   * Emitted when tokens are cleared
   */
  'tokensCleared': (reason: string) => void;

  /**
   * Emitted when network request starts
   */
  'networkRequestStart': (url: string, method: string) => void;

  /**
   * Emitted when network request completes
   */
  'networkRequestComplete': (url: string, method: string, status: number, duration: number) => void;

  /**
   * Emitted when network request fails
   */
  'networkRequestError': (url: string, method: string, error: Error) => void;
}

/**
 * OAuth event emitter interface
 */
export interface OAuthEventEmitter {
  /**
   * Add an event listener
   */
  on<TEvent extends keyof OAuthEventMap>(
    event: TEvent,
    callback: OAuthEventMap[TEvent]
  ): () => void;

  /**
   * Add a one-time event listener
   */
  once<TEvent extends keyof OAuthEventMap>(
    event: TEvent,
    callback: OAuthEventMap[TEvent]
  ): () => void;

  /**
   * Remove an event listener
   */
  off<TEvent extends keyof OAuthEventMap>(
    event: TEvent,
    callback: OAuthEventMap[TEvent]
  ): void;

  /**
   * Emit an event
   */
  emit<TEvent extends keyof OAuthEventMap>(
    event: TEvent,
    ...args: Parameters<OAuthEventMap[TEvent]>
  ): boolean;

  /**
   * Remove all listeners for an event or all events
   */
  removeAllListeners(event?: keyof OAuthEventMap): void;

  /**
   * Get the number of listeners for an event
   */
  listenerCount(event: keyof OAuthEventMap): number;

  /**
   * Check if there are listeners for an event
   */
  hasListeners(event?: keyof OAuthEventMap): boolean;
}

/**
 * Event operation names for consistent loading state tracking
 */
export const OAUTH_OPERATIONS = {
  GENERATE_AUTH_URL: 'generateAuthorizationUrl',
  HANDLE_CALLBACK: 'handleCallback',
  REFRESH_TOKEN: 'refreshToken',
  REVOKE_TOKEN: 'revokeToken',
  EXCHANGE_CODE: 'exchangeCode',
  EXCHANGE_MAGIC_LINK: 'exchangeMagicLink',
  VALIDATE_STATE: 'validateState',
  GENERATE_PKCE: 'generatePKCE',
  STORE_TOKENS: 'storeTokens',
  CLEAR_TOKENS: 'clearTokens',
} as const;

export type OAuthOperation = typeof OAUTH_OPERATIONS[keyof typeof OAUTH_OPERATIONS];
