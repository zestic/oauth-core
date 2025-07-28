/**
 * Core OAuth interfaces and types
 */

import type { FlowConfiguration } from './ConfigTypes';

// Re-export for convenience
export type { FlowConfiguration };

export interface OAuthConfig {
  clientId: string;
  endpoints: {
    authorization: string;
    token: string;
    revocation: string;
  };
  redirectUri: string;
  scopes: string[];
  flows?: FlowConfiguration;
}

export interface OAuthAdapters {
  storage: StorageAdapter;
  http: HttpAdapter;
  pkce: PKCEAdapter;
}

export interface OAuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
  errorCode?: string;
}

export interface StorageAdapter {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  removeItems(keys: string[]): Promise<void>;
}

export interface HttpAdapter {
  post(url: string, data: Record<string, unknown>, headers?: Record<string, string>): Promise<HttpResponse>;
  get(url: string, headers?: Record<string, string>): Promise<HttpResponse>;
}

export interface HttpResponse {
  status: number;
  data: unknown;
  headers: Record<string, string>;
}

export interface PKCEAdapter {
  generateCodeChallenge(): Promise<PKCEChallenge>;
  generateState(): Promise<string>;
}

export interface PKCEChallenge {
  codeChallenge: string;
  codeChallengeMethod: string;
  codeVerifier: string;
}

// FlowConfiguration and CallbackFlowHandler are defined in ConfigTypes.ts and FlowTypes.ts respectively

export interface TokenExchangeRequest {
  grantType: string;
  code?: string;
  redirectUri?: string;
  codeVerifier?: string;
  clientId: string;
  token?: string;
  state?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

export class OAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

export const OAUTH_ERROR_CODES = {
  INVALID_STATE: 'invalid_state',
  TOKEN_EXCHANGE_FAILED: 'token_exchange_failed',
  MISSING_PKCE: 'missing_pkce_parameters',
  NETWORK_ERROR: 'network_error',
  INVALID_GRANT: 'invalid_grant',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
  UNKNOWN_FLOW: 'unknown_flow',
  NO_FLOW_HANDLER: 'no_flow_handler',
  FLOW_VALIDATION_FAILED: 'flow_validation_failed',
  MISSING_REQUIRED_PARAMETER: 'missing_required_parameter',
  INVALID_CONFIGURATION: 'invalid_configuration',
} as const;

export type OAuthErrorCode = typeof OAUTH_ERROR_CODES[keyof typeof OAUTH_ERROR_CODES];
