/**
 * Configuration-related OAuth errors
 * Handles invalid configurations, missing required settings, and validation failures
 */

import { OAuthError, OAuthErrorMetadata } from './OAuthError';

export interface ConfigErrorMetadata extends OAuthErrorMetadata {
  configField?: string;
  expectedType?: string;
  actualType?: string;
  expectedFormat?: string;
  validValues?: string[];
  configPath?: string;
  validationRule?: string;
}

/**
 * Configuration error class for config-related failures
 */
export class ConfigError extends OAuthError {
  constructor(
    message: string,
    code: string,
    metadata: ConfigErrorMetadata = {}
  ) {
    super(message, code, 'config', false, undefined, metadata); // Config errors are not retryable
    this.name = 'ConfigError';
    Object.setPrototypeOf(this, ConfigError.prototype);
  }

  /**
   * Get the configuration field that caused the error
   */
  getConfigField(): string | undefined {
    return (this.metadata as ConfigErrorMetadata).configField;
  }

  /**
   * Get the configuration path (dot notation)
   */
  getConfigPath(): string | undefined {
    return (this.metadata as ConfigErrorMetadata).configPath;
  }

  /**
   * Check if this is a missing field error
   */
  isMissingField(): boolean {
    return this.code === 'CONFIG_MISSING_FIELD' ||
           this.code === 'CONFIG_REQUIRED_FIELD_MISSING';
  }

  /**
   * Check if this is an invalid value error
   */
  isInvalidValue(): boolean {
    return this.code === 'CONFIG_INVALID_VALUE' ||
           this.code === 'CONFIG_INVALID_TYPE' ||
           this.code === 'CONFIG_INVALID_FORMAT';
  }

  /**
   * Check if this is a validation error
   */
  isValidationError(): boolean {
    return this.code === 'CONFIG_VALIDATION_FAILED' ||
           this.code === 'CONFIG_INVALID_URL' ||
           this.code === 'CONFIG_INVALID_SCOPE';
  }

  /**
   * Get user-friendly message
   */
  getUserMessage(): string {
    const field = this.getConfigField();
    
    if (this.isMissingField()) {
      return field ? 
        `Missing required configuration: ${field}` :
        'Missing required configuration. Please check your settings.';
    }

    if (this.isInvalidValue()) {
      return field ?
        `Invalid configuration value for: ${field}` :
        'Invalid configuration value. Please check your settings.';
    }

    if (this.isValidationError()) {
      return 'Configuration validation failed. Please check your settings.';
    }

    return 'Configuration error. Please contact support.';
  }

  /**
   * Create a ConfigError for missing required field
   */
  static missingRequiredField(fieldName: string, configPath?: string): ConfigError {
    return new ConfigError(
      `Missing required configuration field: ${fieldName}`,
      'CONFIG_REQUIRED_FIELD_MISSING',
      {
        configField: fieldName,
        configPath
      }
    );
  }

  /**
   * Create a ConfigError for invalid field type
   */
  static invalidFieldType(
    fieldName: string,
    expectedType: string,
    actualType: string,
    configPath?: string
  ): ConfigError {
    return new ConfigError(
      `Invalid type for configuration field '${fieldName}': expected ${expectedType}, got ${actualType}`,
      'CONFIG_INVALID_TYPE',
      {
        configField: fieldName,
        expectedType,
        actualType,
        configPath
      }
    );
  }

  /**
   * Create a ConfigError for invalid field value
   */
  static invalidFieldValue(
    fieldName: string,
    value: unknown,
    validValues?: string[],
    configPath?: string
  ): ConfigError {
    const validValuesText = validValues ? ` Valid values: ${validValues.join(', ')}` : '';
    return new ConfigError(
      `Invalid value for configuration field '${fieldName}': ${value}.${validValuesText}`,
      'CONFIG_INVALID_VALUE',
      {
        configField: fieldName,
        validValues,
        configPath,
        context: { actualValue: value }
      }
    );
  }

  /**
   * Create a ConfigError for invalid URL format
   */
  static invalidUrl(fieldName: string, url: string, configPath?: string): ConfigError {
    return new ConfigError(
      `Invalid URL format for configuration field '${fieldName}': ${url}`,
      'CONFIG_INVALID_URL',
      {
        configField: fieldName,
        expectedFormat: 'https://example.com/path',
        configPath,
        context: { actualValue: url }
      }
    );
  }

  /**
   * Create a ConfigError for invalid scope format
   */
  static invalidScope(scope: string, validScopes?: string[]): ConfigError {
    const validScopesText = validScopes ? ` Valid scopes: ${validScopes.join(', ')}` : '';
    return new ConfigError(
      `Invalid OAuth scope: ${scope}.${validScopesText}`,
      'CONFIG_INVALID_SCOPE',
      {
        configField: 'scopes',
        validValues: validScopes,
        context: { invalidScope: scope }
      }
    );
  }

  /**
   * Create a ConfigError for missing client ID
   */
  static missingClientId(): ConfigError {
    return ConfigError.missingRequiredField('clientId', 'config.clientId');
  }

  /**
   * Create a ConfigError for missing redirect URI
   */
  static missingRedirectUri(): ConfigError {
    return ConfigError.missingRequiredField('redirectUri', 'config.redirectUri');
  }

  /**
   * Create a ConfigError for missing endpoints
   */
  static missingEndpoints(): ConfigError {
    return ConfigError.missingRequiredField('endpoints', 'config.endpoints');
  }

  /**
   * Create a ConfigError for missing authorization endpoint
   */
  static missingAuthorizationEndpoint(): ConfigError {
    return ConfigError.missingRequiredField('authorization', 'config.endpoints.authorization');
  }

  /**
   * Create a ConfigError for missing token endpoint
   */
  static missingTokenEndpoint(): ConfigError {
    return ConfigError.missingRequiredField('token', 'config.endpoints.token');
  }

  /**
   * Create a ConfigError for invalid redirect URI format
   */
  static invalidRedirectUri(redirectUri: string): ConfigError {
    return ConfigError.invalidUrl('redirectUri', redirectUri, 'config.redirectUri');
  }

  /**
   * Create a ConfigError for invalid authorization endpoint
   */
  static invalidAuthorizationEndpoint(endpoint: string): ConfigError {
    return ConfigError.invalidUrl('authorization', endpoint, 'config.endpoints.authorization');
  }

  /**
   * Create a ConfigError for invalid token endpoint
   */
  static invalidTokenEndpoint(endpoint: string): ConfigError {
    return ConfigError.invalidUrl('token', endpoint, 'config.endpoints.token');
  }

  /**
   * Create a ConfigError for empty scopes array
   */
  static emptyScopes(): ConfigError {
    return new ConfigError(
      'OAuth scopes array cannot be empty',
      'CONFIG_EMPTY_SCOPES',
      {
        configField: 'scopes',
        configPath: 'config.scopes',
        validationRule: 'must contain at least one scope'
      }
    );
  }

  /**
   * Create a ConfigError for validation failure
   */
  static validationFailed(
    fieldName: string,
    rule: string,
    value?: unknown,
    configPath?: string
  ): ConfigError {
    return new ConfigError(
      `Configuration validation failed for '${fieldName}': ${rule}`,
      'CONFIG_VALIDATION_FAILED',
      {
        configField: fieldName,
        validationRule: rule,
        configPath,
        context: { actualValue: value }
      }
    );
  }

  /**
   * Create a ConfigError for incompatible configuration
   */
  static incompatibleConfig(
    reason: string,
    conflictingFields?: string[]
  ): ConfigError {
    return new ConfigError(
      `Incompatible configuration: ${reason}`,
      'CONFIG_INCOMPATIBLE',
      {
        context: {
          conflictingFields,
          reason
        }
      }
    );
  }
}
