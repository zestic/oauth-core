/**
 * @zestic/oauth-core - Framework-agnostic OAuth authentication library
 */

// Core classes
export { OAuthCore } from './core/OAuthCore';
export { FlowRegistry } from './core/FlowRegistry';
export { PKCEManager } from './core/PKCEManager';
export { TokenManager } from './core/TokenManager';
export { StateValidator } from './core/StateValidator';

// Flow handlers
export * from './flows';

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

export { OAUTH_ERROR_CODES } from './types/OAuthTypes';

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

// Utilities
export { ErrorHandler } from './utils/ErrorHandler';
export { UrlParser } from './utils/UrlParser';

// Note: Use 'new OAuthCore(config, adapters, flowConfig)' to create instances
