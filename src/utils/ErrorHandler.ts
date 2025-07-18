/**
 * Standardized error handling for OAuth operations
 */

import { OAuthError, OAUTH_ERROR_CODES, OAuthErrorCode } from '../types/OAuthTypes';

export class ErrorHandler {
  static createError(message: string, code: OAuthErrorCode, originalError?: Error): OAuthError {
    return new OAuthError(message, code, originalError);
  }

  static handleNetworkError(error: Error): OAuthError {
    return new OAuthError(
      `Network error: ${error.message}`,
      OAUTH_ERROR_CODES.NETWORK_ERROR,
      error
    );
  }

  static handleTokenExchangeError(error: Error, response?: unknown): OAuthError {
    let message = 'Token exchange failed';
    
    if (response && typeof response === 'object' && response !== null) {
      const errorResponse = response as Record<string, unknown>;
      if (errorResponse.error_description) {
        message = `Token exchange failed: ${String(errorResponse.error_description)}`;
      } else if (errorResponse.error) {
        message = `Token exchange failed: ${String(errorResponse.error)}`;
      }
    }

    return new OAuthError(message, OAUTH_ERROR_CODES.TOKEN_EXCHANGE_FAILED, error);
  }

  static handleInvalidState(expectedState?: string, receivedState?: string): OAuthError {
    const message = expectedState && receivedState
      ? `Invalid state parameter. Expected: ${expectedState}, Received: ${receivedState}`
      : 'Invalid or missing state parameter';
    
    return new OAuthError(message, OAUTH_ERROR_CODES.INVALID_STATE);
  }

  static handleMissingParameter(parameterName: string): OAuthError {
    return new OAuthError(
      `Missing required parameter: ${parameterName}`,
      OAUTH_ERROR_CODES.MISSING_REQUIRED_PARAMETER
    );
  }

  static handleInvalidConfiguration(message: string): OAuthError {
    return new OAuthError(
      `Invalid configuration: ${message}`,
      OAUTH_ERROR_CODES.INVALID_CONFIGURATION
    );
  }

  static handleUnknownFlow(flowName: string): OAuthError {
    return new OAuthError(
      `Unknown flow: ${flowName}`,
      OAUTH_ERROR_CODES.UNKNOWN_FLOW
    );
  }

  static handleNoFlowHandler(): OAuthError {
    return new OAuthError(
      'No suitable flow handler found for the provided parameters',
      OAUTH_ERROR_CODES.NO_FLOW_HANDLER
    );
  }

  static handleFlowValidationFailed(flowName: string, reason?: string): OAuthError {
    const message = reason
      ? `Flow validation failed for ${flowName}: ${reason}`
      : `Flow validation failed for ${flowName}`;
    
    return new OAuthError(message, OAUTH_ERROR_CODES.FLOW_VALIDATION_FAILED);
  }

  static isOAuthError(error: unknown): error is OAuthError {
    return error instanceof OAuthError;
  }

  static getErrorCode(error: unknown): string | undefined {
    if (this.isOAuthError(error)) {
      return error.code;
    }
    return undefined;
  }

  static formatError(error: unknown): string {
    if (this.isOAuthError(error)) {
      return `[${error.code}] ${error.message}`;
    }
    
    if (error instanceof Error) {
      return error.message;
    }
    
    return String(error);
  }

  static logError(error: unknown, context?: string): void {
    const formattedError = this.formatError(error);
    const logMessage = context ? `${context}: ${formattedError}` : formattedError;
    
    console.error(logMessage);
    
    if (this.isOAuthError(error) && error.originalError) {
      console.error('Original error:', error.originalError);
    }
  }
}
