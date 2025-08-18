/**
 * @zestic/oauth-core - Framework-agnostic OAuth authentication library
 */

// Core classes
export { OAuthCore } from './core/OAuthCore';
export { CallbackFlowRegistry } from './core/CallbackFlowRegistry';
export { PKCEManager } from './core/PKCEManager';
export { TokenManager } from './core/TokenManager';
export { StateValidator } from './core/StateValidator';

// Event system
export * from './events';

// Error system
export * from './errors';

// Flow handlers
export * from './flows';

// Services
export * from './services';

// GraphQL
export * from './graphql';

// Types (avoiding duplicate exports)
export type {
  OAuthConfig,
  OAuthAdapters,
  OAuthResult,
  StorageAdapter,
  HttpAdapter,
  PKCEAdapter,
  HttpResponse,
  PKCEChallenge,
  TokenExchangeRequest,
  TokenResponse,
  OAuthError,
  OAuthErrorCode,
  FlowConfiguration
} from './types/OAuthTypes';

// Error codes are now available from ./errors
// No legacy exports needed for pre-1.0 library

export type {
  OAuthEndpoints,
  DetectionStrategy,
  OAuthConfigOptions,
  StorageConfig,
  HttpConfig,
  PKCEConfig,
  AdapterConfig,
  OAuthCoreConfig,
  DEFAULT_CONFIG
} from './types/ConfigTypes';

// Service types
export type {
  RegistrationInput,
  SendMagicLinkInput,
  RegistrationResponse,
  MagicLinkResponse,
  UserAdapter,
  GraphQLAdapter,
  ExtendedOAuthAdapters,
  MagicLinkConfig,
  MagicLinkToken,
  UserRegistrationResult,
  UserInfo,
  GraphQLOptions,
  GraphQLResult,
  ServiceResult
} from './types/ServiceTypes';

// Utilities
export { ErrorHandler } from './utils/ErrorHandler';
export { UrlParser } from './utils/UrlParser';

// Note: Use 'new OAuthCore(config, adapters, flowConfig)' to create instances
