/**
 * Configuration-related types and interfaces
 */

import { FlowHandler } from './OAuthTypes';

export interface OAuthEndpoints {
  authorization: string;
  token: string;
  revocation: string;
}

export interface FlowConfiguration {
  enabledFlows?: string[];
  disabledFlows?: string[];
  customFlows?: FlowHandler[];
  defaultFlow?: string;
  detectionStrategy?: DetectionStrategy;
}

export type DetectionStrategy = 'auto' | 'priority' | 'explicit';

export interface OAuthConfigOptions {
  clientId: string;
  endpoints: OAuthEndpoints;
  redirectUri: string;
  scopes: string[];
  flows?: FlowConfiguration;
  timeout?: number;
  retryAttempts?: number;
}

export interface StorageConfig {
  keyPrefix?: string;
  encryptionKey?: string;
}

export interface HttpConfig {
  timeout?: number;
  retryAttempts?: number;
  userAgent?: string;
  headers?: Record<string, string>;
}

export interface PKCEConfig {
  method?: 'S256' | 'plain';
  length?: number;
}

export interface AdapterConfig {
  storage?: StorageConfig;
  http?: HttpConfig;
  pkce?: PKCEConfig;
}

export interface OAuthCoreConfig extends OAuthConfigOptions {
  adapters?: AdapterConfig;
}

export const DEFAULT_CONFIG: Partial<OAuthCoreConfig> = {
  timeout: 30000,
  retryAttempts: 3,
  flows: {
    detectionStrategy: 'auto',
  },
  adapters: {
    pkce: {
      method: 'S256',
      length: 128,
    },
    http: {
      timeout: 30000,
      retryAttempts: 3,
    },
    storage: {
      keyPrefix: 'oauth_',
    },
  },
};
