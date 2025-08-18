/**
 * Error factory functions for common scenarios
 */

import { OAuthError, OAuthErrorType } from './OAuthError';
import { NetworkError } from './NetworkError';
import { TokenError } from './TokenError';
import { ConfigError } from './ConfigError';
import { ValidationError } from './ValidationError';
import { FlowError } from './FlowError';

// Pre-1.0: No need for error code constants - use string literals directly

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
      code || 'TOKEN_ERROR',
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
