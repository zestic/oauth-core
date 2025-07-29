/**
 * Flow handler types and interfaces
 */

import { OAuthConfig, OAuthAdapters, OAuthResult } from './OAuthTypes';

export interface CallbackFlowHandler {
  readonly name: string;
  readonly priority: number;

  canHandle(params: URLSearchParams, config: OAuthConfig): boolean;
  handle(params: URLSearchParams, adapters: OAuthAdapters, config: OAuthConfig): Promise<OAuthResult>;
  validate(params: URLSearchParams, config: OAuthConfig): Promise<boolean>;
}

export interface CallbackFlowDetectionResult {
  handler: CallbackFlowHandler;
  confidence: number;
  reason: string;
}

export interface CallbackFlowRegistryOptions {
  allowDuplicates?: boolean;
  defaultPriority?: number;
}



export interface MagicLinkFlowParams {
  token?: string;
  magic_link_token?: string;
  flow?: 'login' | 'verify';
  state?: string;
  error?: string;
  error_description?: string;
}

export interface DeviceCodeFlowParams {
  device_code: string;
  user_code?: string;
  verification_uri?: string;
  verification_uri_complete?: string;
  expires_in?: number;
  interval?: number;
}

export interface SAMLAssertionFlowParams {
  saml_response: string;
  relay_state?: string;
}

export interface FlowContext {
  startTime: number;
  flowName: string;
  parameters: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface FlowResult extends OAuthResult {
  flowName: string;
  duration: number;
  context?: FlowContext;
}

export type FlowParameterValidator = (params: URLSearchParams) => boolean;
export type FlowParameterExtractor<T> = (params: URLSearchParams) => T;

export interface CallbackFlowHandlerConfig {
  name: string;
  priority: number;
  validator: FlowParameterValidator;
  handler: (params: URLSearchParams, adapters: OAuthAdapters, config: OAuthConfig) => Promise<OAuthResult>;
  parameterExtractor?: FlowParameterExtractor<unknown>;
}

export const FLOW_PRIORITIES = {
  HIGHEST: 1,
  HIGH: 25,
  NORMAL: 50,
  LOW: 75,
  LOWEST: 100,
} as const;

export const BUILT_IN_FLOWS = {
  MAGIC_LINK: 'magic_link',
  DEVICE_CODE: 'device_code',
  SAML_ASSERTION: 'saml_assertion',
} as const;
