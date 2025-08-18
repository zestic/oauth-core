/**
 * Event system exports
 */

// Core event emitter
export { EventEmitter } from './EventEmitter';
export type { EventCallback, UnsubscribeFunction, EventEmitterOptions } from './EventEmitter';

// OAuth-specific events
export {
  OAUTH_OPERATIONS
} from './OAuthEvents';

export type {
  AuthStatus,
  OAuthTokens,
  LoadingContext,
  TokenExpirationData,
  AuthSuccessData,
  AuthErrorData,
  LogoutData,
  ConfigValidationData,
  OAuthEventMap,
  OAuthEventEmitter,
  OAuthOperation
} from './OAuthEvents';
