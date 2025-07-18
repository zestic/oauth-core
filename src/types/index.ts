/**
 * OAuth Core Types
 * Central export point for all OAuth-related types and interfaces
 */

// Core OAuth types
export type {
  OAuthConfig,
  OAuthAdapters,
  OAuthResult,
  StorageAdapter,
  HttpAdapter,
  PKCEAdapter,
  HttpResponse,
  PKCEChallenge,
  FlowHandler,
  TokenExchangeRequest,
} from './OAuthTypes';

// Configuration types
export type {
  OAuthEndpoints,
  FlowConfiguration,
  DetectionStrategy,
  OAuthConfigOptions,
} from './ConfigTypes';

// Flow types
export type {
  FlowDetectionResult,
  FlowRegistryOptions,
  AuthorizationCodeFlowParams,
} from './FlowTypes';
