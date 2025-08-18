/**
 * Standardized error handling for OAuth operations
 */

import {
  OAuthError,
  ValidationError,
  ConfigError,
  FlowError,
  TokenError,
  ErrorFactory
} from '../errors';

export class ErrorHandler {
  static createError(message: string, code: string, originalError?: Error): OAuthError {
    const metadata = originalError ? { originalError } : {};
    return new OAuthError(message, code, 'auth', true, undefined, metadata);
  }

  static handleNetworkError(error: Error): OAuthError {
    return ErrorFactory.fromError(error, 'network', 'NETWORK_ERROR', true);
  }

  static handleTokenExchangeError(error: Error, response?: unknown): TokenError {
    let message = 'Token exchange failed';

    if (response && typeof response === 'object' && response !== null) {
      const errorResponse = response as Record<string, unknown>;
      if (errorResponse.error_description) {
        message = `Token exchange failed: ${String(errorResponse.error_description)}`;
      } else if (errorResponse.error) {
        message = `Token exchange failed: ${String(errorResponse.error)}`;
      }
    }

    return new TokenError(message, 'TOKEN_ERROR', { originalError: error });
  }

  static handleInvalidState(expectedState?: string, receivedState?: string): ValidationError {
    const message = expectedState && receivedState
      ? `Invalid state parameter. Expected: ${expectedState}, Received: ${receivedState}`
      : 'Invalid or missing state parameter';

    return new ValidationError(message, 'VALIDATION_INVALID_STATE', {
      expectedValue: expectedState,
      actualValue: receivedState,
      parameterName: 'state'
    });
  }

  static handleMissingParameter(parameterName: string): ValidationError {
    return new ValidationError(
      `Missing required parameter: ${parameterName}`,
      'VALIDATION_MISSING_PARAMETER',
      { parameterName }
    );
  }

  static handleInvalidConfiguration(message: string): ConfigError {
    return new ConfigError(`Invalid configuration: ${message}`, 'CONFIG_ERROR');
  }

  static handleUnknownFlow(flowName: string): FlowError {
    return new FlowError(`Unknown flow: ${flowName}`, 'FLOW_UNKNOWN', { flowName });
  }

  static handleNoFlowHandler(): FlowError {
    return new FlowError('No suitable flow handler found for the provided parameters', 'FLOW_NO_HANDLER_FOUND');
  }

  static handleFlowValidationFailed(flowName: string, reason?: string): FlowError {
    const message = reason
      ? `Flow validation failed for ${flowName}: ${reason}`
      : `Flow validation failed for ${flowName}`;

    return new FlowError(message, 'FLOW_VALIDATION_FAILED', {
      flowName,
      detectionReason: reason
    });
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
    
    if (this.isOAuthError(error) && error.metadata?.originalError) {
      console.error('Original error:', error.metadata.originalError);
    }
  }
}
