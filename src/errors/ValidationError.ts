/**
 * Validation-related OAuth errors
 * Handles parameter validation, state validation, and request validation failures
 */

import { OAuthError, OAuthErrorMetadata } from './OAuthError';

export interface ValidationErrorMetadata extends OAuthErrorMetadata {
  parameterName?: string;
  expectedValue?: unknown;
  actualValue?: unknown;
  validationRule?: string;
  allowedValues?: unknown[];
  parameterType?: string;
}

/**
 * Validation error class for parameter and request validation failures
 */
export class ValidationError extends OAuthError {
  constructor(
    message: string,
    code: string,
    metadata: ValidationErrorMetadata = {},
    retryable: boolean = false
  ) {
    super(message, code, 'validation', retryable, undefined, metadata);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }

  /**
   * Get the parameter name that failed validation
   */
  getParameterName(): string | undefined {
    return (this.metadata as ValidationErrorMetadata).parameterName;
  }

  /**
   * Get the validation rule that failed
   */
  getValidationRule(): string | undefined {
    return (this.metadata as ValidationErrorMetadata).validationRule;
  }

  /**
   * Check if this is a missing parameter error
   */
  isMissingParameter(): boolean {
    return this.code === 'VALIDATION_MISSING_PARAMETER' ||
           this.code === 'VALIDATION_REQUIRED_PARAMETER_MISSING';
  }

  /**
   * Check if this is an invalid parameter error
   */
  isInvalidParameter(): boolean {
    return this.code === 'VALIDATION_INVALID_PARAMETER' ||
           this.code === 'VALIDATION_INVALID_FORMAT' ||
           this.code === 'VALIDATION_INVALID_VALUE';
  }

  /**
   * Check if this is a state validation error
   */
  isStateValidationError(): boolean {
    return this.code === 'VALIDATION_INVALID_STATE' ||
           this.code === 'VALIDATION_STATE_MISMATCH';
  }

  /**
   * Get user-friendly message
   */
  getUserMessage(): string {
    const paramName = this.getParameterName();

    if (this.isMissingParameter()) {
      return paramName ?
        `Missing required parameter: ${paramName}` :
        'Missing required parameter. Please check your request.';
    }

    if (this.isInvalidParameter()) {
      return paramName ?
        `Invalid parameter value: ${paramName}` :
        'Invalid parameter value. Please check your request.';
    }

    if (this.isStateValidationError()) {
      return 'Security validation failed. Please try again.';
    }

    return 'Request validation failed. Please check your parameters.';
  }

  /**
   * Create a ValidationError for missing required parameter
   */
  static missingRequiredParameter(parameterName: string): ValidationError {
    return new ValidationError(
      `Missing required parameter: ${parameterName}`,
      'VALIDATION_REQUIRED_PARAMETER_MISSING',
      {
        parameterName,
        validationRule: 'required'
      }
    );
  }

  /**
   * Create a ValidationError for invalid parameter format
   */
  static invalidParameterFormat(
    parameterName: string,
    expectedFormat: string,
    actualValue: unknown
  ): ValidationError {
    return new ValidationError(
      `Invalid format for parameter '${parameterName}': expected ${expectedFormat}`,
      'VALIDATION_INVALID_FORMAT',
      {
        parameterName,
        validationRule: `format: ${expectedFormat}`,
        actualValue,
        context: { expectedFormat }
      }
    );
  }

  /**
   * Create a ValidationError for invalid parameter value
   */
  static invalidParameterValue(
    parameterName: string,
    actualValue: unknown,
    allowedValues?: unknown[]
  ): ValidationError {
    const allowedText = allowedValues ? ` Allowed values: ${allowedValues.join(', ')}` : '';
    return new ValidationError(
      `Invalid value for parameter '${parameterName}': ${actualValue}.${allowedText}`,
      'VALIDATION_INVALID_VALUE',
      {
        parameterName,
        actualValue,
        allowedValues,
        validationRule: allowedValues ? `one of: ${allowedValues.join(', ')}` : 'valid value'
      }
    );
  }

  /**
   * Create a ValidationError for invalid parameter type
   */
  static invalidParameterType(
    parameterName: string,
    expectedType: string,
    actualValue: unknown
  ): ValidationError {
    const actualType = typeof actualValue;
    return new ValidationError(
      `Invalid type for parameter '${parameterName}': expected ${expectedType}, got ${actualType}`,
      'VALIDATION_INVALID_TYPE',
      {
        parameterName,
        parameterType: expectedType,
        actualValue,
        validationRule: `type: ${expectedType}`,
        context: { expectedType, actualType }
      }
    );
  }

  /**
   * Create a ValidationError for state mismatch
   */
  static stateMismatch(expectedState?: string, actualState?: string): ValidationError {
    return new ValidationError(
      'OAuth state parameter mismatch - possible CSRF attack',
      'VALIDATION_STATE_MISMATCH',
      {
        parameterName: 'state',
        expectedValue: expectedState,
        actualValue: actualState,
        validationRule: 'state must match stored value'
      }
    );
  }

  /**
   * Create a ValidationError for missing state
   */
  static missingState(): ValidationError {
    return new ValidationError(
      'Missing OAuth state parameter',
      'VALIDATION_MISSING_STATE',
      {
        parameterName: 'state',
        validationRule: 'state parameter required for security'
      }
    );
  }

  /**
   * Create a ValidationError for invalid URL
   */
  static invalidUrl(parameterName: string, url: string): ValidationError {
    return new ValidationError(
      `Invalid URL format for parameter '${parameterName}': ${url}`,
      'VALIDATION_INVALID_URL',
      {
        parameterName,
        actualValue: url,
        validationRule: 'valid URL format',
        context: { expectedFormat: 'https://example.com/path' }
      }
    );
  }

  /**
   * Create a ValidationError for invalid code challenge method
   */
  static invalidCodeChallengeMethod(method: string): ValidationError {
    return ValidationError.invalidParameterValue(
      'code_challenge_method',
      method,
      ['S256', 'plain']
    );
  }

  /**
   * Create a ValidationError for invalid grant type
   */
  static invalidGrantType(grantType: string): ValidationError {
    return ValidationError.invalidParameterValue(
      'grant_type',
      grantType,
      ['authorization_code', 'refresh_token', 'client_credentials']
    );
  }

  /**
   * Create a ValidationError for invalid response type
   */
  static invalidResponseType(responseType: string): ValidationError {
    return ValidationError.invalidParameterValue(
      'response_type',
      responseType,
      ['code', 'token', 'id_token']
    );
  }

  /**
   * Create a ValidationError for invalid scope format
   */
  static invalidScopeFormat(scope: string): ValidationError {
    return ValidationError.invalidParameterFormat(
      'scope',
      'space-separated string',
      scope
    );
  }

  /**
   * Create a ValidationError for parameter length validation
   */
  static parameterTooLong(
    parameterName: string,
    actualLength: number,
    maxLength: number
  ): ValidationError {
    return new ValidationError(
      `Parameter '${parameterName}' is too long: ${actualLength} characters (max: ${maxLength})`,
      'VALIDATION_PARAMETER_TOO_LONG',
      {
        parameterName,
        validationRule: `max length: ${maxLength}`,
        context: { actualLength, maxLength }
      }
    );
  }

  /**
   * Create a ValidationError for parameter too short
   */
  static parameterTooShort(
    parameterName: string,
    actualLength: number,
    minLength: number
  ): ValidationError {
    return new ValidationError(
      `Parameter '${parameterName}' is too short: ${actualLength} characters (min: ${minLength})`,
      'VALIDATION_PARAMETER_TOO_SHORT',
      {
        parameterName,
        validationRule: `min length: ${minLength}`,
        context: { actualLength, minLength }
      }
    );
  }

  /**
   * Create a ValidationError for regex pattern mismatch
   */
  static patternMismatch(
    parameterName: string,
    pattern: string,
    actualValue: string
  ): ValidationError {
    return new ValidationError(
      `Parameter '${parameterName}' does not match required pattern: ${pattern}`,
      'VALIDATION_PATTERN_MISMATCH',
      {
        parameterName,
        actualValue,
        validationRule: `pattern: ${pattern}`,
        context: { pattern }
      }
    );
  }
}
