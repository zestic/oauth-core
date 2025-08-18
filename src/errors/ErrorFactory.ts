/**
 * Error factory functions for common scenarios
 */

import { OAuthError, OAuthErrorType } from './OAuthError';
import { NetworkError } from './NetworkError';
import { TokenError } from './TokenError';
import { ConfigError } from './ConfigError';
import { ValidationError } from './ValidationError';
import { FlowError } from './FlowError';

// Import error codes
const OAUTH_ERROR_CODES = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  NETWORK_CONNECTION_ERROR: 'NETWORK_CONNECTION_ERROR',
  NETWORK_SERVER_ERROR: 'NETWORK_SERVER_ERROR',
  NETWORK_CLIENT_ERROR: 'NETWORK_CLIENT_ERROR',
  NETWORK_RATE_LIMITED: 'NETWORK_RATE_LIMITED',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',

  // Token errors
  TOKEN_ERROR: 'TOKEN_ERROR',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_MISSING: 'TOKEN_MISSING',
  TOKEN_REFRESH_FAILED: 'TOKEN_REFRESH_FAILED',
  TOKEN_VALIDATION_FAILED: 'TOKEN_VALIDATION_FAILED',
  TOKEN_INSUFFICIENT_SCOPE: 'TOKEN_INSUFFICIENT_SCOPE',
  TOKEN_INVALID_GRANT: 'TOKEN_INVALID_GRANT',
  TOKEN_INVALID_SCOPE: 'TOKEN_INVALID_SCOPE',
  ACCESS_TOKEN_EXPIRED: 'ACCESS_TOKEN_EXPIRED',
  ACCESS_TOKEN_INVALID: 'ACCESS_TOKEN_INVALID',
  ACCESS_TOKEN_MISSING: 'ACCESS_TOKEN_MISSING',
  REFRESH_TOKEN_EXPIRED: 'REFRESH_TOKEN_EXPIRED',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_MISSING: 'REFRESH_TOKEN_MISSING',

  // Configuration errors
  CONFIG_ERROR: 'CONFIG_ERROR',
  CONFIG_MISSING_FIELD: 'CONFIG_MISSING_FIELD',
  CONFIG_REQUIRED_FIELD_MISSING: 'CONFIG_REQUIRED_FIELD_MISSING',
  CONFIG_INVALID_TYPE: 'CONFIG_INVALID_TYPE',
  CONFIG_INVALID_VALUE: 'CONFIG_INVALID_VALUE',
  CONFIG_INVALID_URL: 'CONFIG_INVALID_URL',
  CONFIG_INVALID_SCOPE: 'CONFIG_INVALID_SCOPE',
  CONFIG_VALIDATION_FAILED: 'CONFIG_VALIDATION_FAILED',
  CONFIG_EMPTY_SCOPES: 'CONFIG_EMPTY_SCOPES',
  CONFIG_INCOMPATIBLE: 'CONFIG_INCOMPATIBLE',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  VALIDATION_MISSING_PARAMETER: 'VALIDATION_MISSING_PARAMETER',
  VALIDATION_REQUIRED_PARAMETER_MISSING: 'VALIDATION_REQUIRED_PARAMETER_MISSING',
  VALIDATION_INVALID_PARAMETER: 'VALIDATION_INVALID_PARAMETER',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  VALIDATION_INVALID_VALUE: 'VALIDATION_INVALID_VALUE',
  VALIDATION_INVALID_TYPE: 'VALIDATION_INVALID_TYPE',
  VALIDATION_INVALID_STATE: 'VALIDATION_INVALID_STATE',
  VALIDATION_STATE_MISMATCH: 'VALIDATION_STATE_MISMATCH',
  VALIDATION_MISSING_STATE: 'VALIDATION_MISSING_STATE',
  VALIDATION_INVALID_URL: 'VALIDATION_INVALID_URL',
  VALIDATION_PARAMETER_TOO_LONG: 'VALIDATION_PARAMETER_TOO_LONG',
  VALIDATION_PARAMETER_TOO_SHORT: 'VALIDATION_PARAMETER_TOO_SHORT',
  VALIDATION_PATTERN_MISMATCH: 'VALIDATION_PATTERN_MISMATCH',

  // Flow errors
  FLOW_ERROR: 'FLOW_ERROR',
  FLOW_DETECTION_FAILED: 'FLOW_DETECTION_FAILED',
  FLOW_NO_HANDLER_FOUND: 'FLOW_NO_HANDLER_FOUND',
  FLOW_UNKNOWN: 'FLOW_UNKNOWN',
  FLOW_VALIDATION_FAILED: 'FLOW_VALIDATION_FAILED',
  FLOW_MISSING_PARAMETERS: 'FLOW_MISSING_PARAMETERS',
  FLOW_INVALID_PARAMETERS: 'FLOW_INVALID_PARAMETERS',
  FLOW_EXECUTION_FAILED: 'FLOW_EXECUTION_FAILED',
  FLOW_TIMEOUT: 'FLOW_TIMEOUT',
  FLOW_INTERRUPTED: 'FLOW_INTERRUPTED',
  FLOW_AMBIGUOUS_DETECTION: 'FLOW_AMBIGUOUS_DETECTION',
  FLOW_DISABLED: 'FLOW_DISABLED',
  FLOW_NOT_SUPPORTED: 'FLOW_NOT_SUPPORTED',
  FLOW_INVALID_STATE: 'FLOW_INVALID_STATE',

  // Legacy error codes (for backward compatibility)
  INVALID_STATE: 'VALIDATION_INVALID_STATE',
  TOKEN_EXCHANGE_FAILED: 'TOKEN_ERROR',
  MISSING_PKCE: 'VALIDATION_MISSING_PARAMETER',
  INVALID_GRANT: 'TOKEN_INVALID_GRANT',
  UNSUPPORTED_GRANT_TYPE: 'TOKEN_INVALID_GRANT',
  UNKNOWN_FLOW: 'FLOW_UNKNOWN',
  NO_FLOW_HANDLER: 'FLOW_NO_HANDLER_FOUND',
  MISSING_REQUIRED_PARAMETER: 'VALIDATION_REQUIRED_PARAMETER_MISSING',
  INVALID_CONFIGURATION: 'CONFIG_ERROR'
} as const;

export class ErrorFactory {
  /**
   * Create a network error from an HTTP response
   */
  static networkError(
    statusCode: number,
    responseBody?: any,
    url?: string,
    method?: string
  ): NetworkError {
    return NetworkError.fromHttpResponse(statusCode, responseBody, url, method);
  }

  /**
   * Create a network error from a connection failure
   */
  static connectionError(error: Error, url?: string, method?: string): NetworkError {
    return NetworkError.fromConnectionError(error, url, method);
  }

  /**
   * Create a token expired error
   */
  static tokenExpired(tokenType: 'access' | 'refresh' = 'access', expiresAt?: Date): TokenError {
    return tokenType === 'access' 
      ? TokenError.accessTokenExpired(expiresAt)
      : TokenError.refreshTokenExpired(expiresAt);
  }

  /**
   * Create a token invalid error
   */
  static tokenInvalid(tokenType: 'access' | 'refresh' = 'access', tokenHint?: string): TokenError {
    return tokenType === 'access'
      ? TokenError.accessTokenInvalid(tokenHint)
      : TokenError.refreshTokenInvalid(tokenHint);
  }

  /**
   * Create a token missing error
   */
  static tokenMissing(tokenType: 'access' | 'refresh' = 'access'): TokenError {
    return tokenType === 'access'
      ? TokenError.accessTokenMissing()
      : TokenError.refreshTokenMissing();
  }

  /**
   * Create a configuration error for missing field
   */
  static configMissingField(fieldName: string, configPath?: string): ConfigError {
    return ConfigError.missingRequiredField(fieldName, configPath);
  }

  /**
   * Create a configuration error for invalid value
   */
  static configInvalidValue(
    fieldName: string,
    value: any,
    validValues?: string[]
  ): ConfigError {
    return ConfigError.invalidFieldValue(fieldName, value, validValues);
  }

  /**
   * Create a validation error for missing parameter
   */
  static validationMissingParameter(parameterName: string): ValidationError {
    return ValidationError.missingRequiredParameter(parameterName);
  }

  /**
   * Create a validation error for invalid parameter
   */
  static validationInvalidParameter(
    parameterName: string,
    actualValue: any,
    allowedValues?: any[]
  ): ValidationError {
    return ValidationError.invalidParameterValue(parameterName, actualValue, allowedValues);
  }

  /**
   * Create a flow error for no handler found
   */
  static flowNoHandler(availableFlows?: string[]): FlowError {
    return FlowError.noHandlerFound(availableFlows);
  }

  /**
   * Create a flow error for validation failure
   */
  static flowValidationFailed(
    flowName: string,
    reason?: string,
    missingParameters?: string[]
  ): FlowError {
    return FlowError.validationFailed(flowName, reason, missingParameters);
  }

  /**
   * Create an error from a generic Error object
   */
  static fromError(
    error: Error,
    type: OAuthErrorType = 'auth',
    code?: string,
    retryable: boolean = false
  ): OAuthError {
    return OAuthError.fromError(
      error,
      code || OAUTH_ERROR_CODES.TOKEN_ERROR,
      type,
      retryable
    );
  }

  /**
   * Check if an error is an OAuth error
   */
  static isOAuthError(error: unknown): error is OAuthError {
    return OAuthError.isOAuthError(error);
  }

  /**
   * Get error type from error code
   */
  static getErrorType(code: string): OAuthErrorType {
    if (code.startsWith('NETWORK_')) return 'network';
    if (code.startsWith('TOKEN_')) return 'token';
    if (code.startsWith('CONFIG_')) return 'config';
    if (code.startsWith('VALIDATION_')) return 'validation';
    if (code.startsWith('FLOW_')) return 'flow';
    return 'auth';
  }
}
