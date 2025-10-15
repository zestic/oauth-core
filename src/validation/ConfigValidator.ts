/**
 * Configuration validation utilities for OAuth configurations
 * Provides comprehensive validation with detailed error reporting
 */

import type { OAuthConfig } from '../types/OAuthTypes';

export interface ConfigError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export interface ConfigWarning extends ConfigError {
  severity: 'warning';
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigError[];
  warnings: ConfigWarning[];
}

/**
 * Configuration validator for OAuth settings
 * Provides static methods to validate different aspects of OAuth configuration
 */
export class ConfigValidator {
  /**
   * Validate complete OAuth configuration
   */
  static validate(config: OAuthConfig): ConfigValidationResult {
    const errors: ConfigError[] = [];
    const warnings: ConfigWarning[] = [];

    // Validate client ID
    const clientIdErrors = this.validateClientId(config.clientId);
    errors.push(...clientIdErrors);

    // Validate endpoints
    const endpointResult = this.validateEndpoints(config.endpoints);
    errors.push(...endpointResult.errors);
    warnings.push(...endpointResult.warnings);

    // Validate redirect URI
    const redirectUriErrors = this.validateRedirectUri(config.redirectUri);
    errors.push(...redirectUriErrors);

    // Validate scopes
    const scopeWarnings = this.validateScopes(config.scopes);
    warnings.push(...scopeWarnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate OAuth client ID
   */
  static validateClientId(clientId: string): ConfigError[] {
    const errors: ConfigError[] = [];

    if (!clientId || typeof clientId !== 'string') {
      errors.push({
        field: 'clientId',
        message: 'Client ID is required and must be a non-empty string',
        code: 'MISSING_CLIENT_ID',
        severity: 'error'
      });
      return errors;
    }

    // Check for potentially problematic characters first
    if (clientId.includes(' ')) {
      errors.push({
        field: 'clientId',
        message: 'Client ID should not contain spaces',
        code: 'CLIENT_ID_HAS_SPACES',
        severity: 'error'
      });
    }

    if (clientId.trim().length === 0) {
      errors.push({
        field: 'clientId',
        message: 'Client ID cannot be empty or whitespace-only',
        code: 'EMPTY_CLIENT_ID',
        severity: 'error'
      });
    }

    return errors;
  }

  /**
   * Validate OAuth endpoints
   */
  static validateEndpoints(endpoints: { authorization: string; token: string; revocation?: string }): {
    errors: ConfigError[];
    warnings: ConfigWarning[];
  } {
    const errors: ConfigError[] = [];
    const warnings: ConfigWarning[] = [];
    const requiredEndpoints = ['authorization', 'token'] as const;
    const optionalEndpoints = ['revocation'] as const;

    // Check required endpoints
    for (const endpoint of requiredEndpoints) {
      const value = endpoints[endpoint];
      if (!value || typeof value !== 'string') {
        errors.push({
          field: `endpoints.${endpoint}`,
          message: `${endpoint} endpoint is required`,
          code: `MISSING_${endpoint.toUpperCase()}_ENDPOINT`,
          severity: 'error'
        });
        continue;
      }

      const urlErrors = this.validateUrl(value, `endpoints.${endpoint}`);
      errors.push(...urlErrors);

      // Check for HTTPS in production-like environments
      if (!value.startsWith('https://') && !value.startsWith('http://localhost')) {
        warnings.push({
          field: `endpoints.${endpoint}`,
          message: `${endpoint} endpoint should use HTTPS for security`,
          code: `${endpoint.toUpperCase()}_NOT_HTTPS`,
          severity: 'warning'
        });
      }
    }

    // Check optional endpoints
    for (const endpoint of optionalEndpoints) {
      const value = endpoints[endpoint];
      if (value) {
        const urlErrors = this.validateUrl(value, `endpoints.${endpoint}`);
        errors.push(...urlErrors);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate redirect URI
   */
  static validateRedirectUri(redirectUri: string): ConfigError[] {
    const errors: ConfigError[] = [];

    if (!redirectUri || typeof redirectUri !== 'string') {
      errors.push({
        field: 'redirectUri',
        message: 'Redirect URI is required and must be a string',
        code: 'MISSING_REDIRECT_URI',
        severity: 'error'
      });
      return errors;
    }

    if (redirectUri.trim().length === 0) {
      errors.push({
        field: 'redirectUri',
        message: 'Redirect URI cannot be empty',
        code: 'EMPTY_REDIRECT_URI',
        severity: 'error'
      });
      return errors;
    }

    // Additional redirect URI specific validations
    if (redirectUri.includes('#')) {
      errors.push({
        field: 'redirectUri',
        message: 'Redirect URI should not contain fragment (#) as it will be lost during redirect',
        code: 'REDIRECT_URI_HAS_FRAGMENT',
        severity: 'error'
      });
    }

    // Check for localhost/dev URLs
    const isLocalhost = redirectUri.startsWith('http://localhost') ||
                       redirectUri.startsWith('http://127.0.0.1') ||
                       redirectUri.startsWith('http://0.0.0.0');

    if (!isLocalhost && !redirectUri.startsWith('https://')) {
      errors.push({
        field: 'redirectUri',
        message: 'Redirect URI should use HTTPS (except for localhost development)',
        code: 'REDIRECT_URI_NOT_HTTPS',
        severity: 'error'
      });
    }

    return errors;
  }

  /**
   * Validate OAuth scopes
   */
  static validateScopes(scopes: string[]): ConfigWarning[] {
    const warnings: ConfigWarning[] = [];

    if (!Array.isArray(scopes)) {
      warnings.push({
        field: 'scopes',
        message: 'Scopes should be an array of strings',
        code: 'SCOPES_NOT_ARRAY',
        severity: 'warning'
      });
      return warnings;
    }

    if (scopes.length === 0) {
      warnings.push({
        field: 'scopes',
        message: 'No scopes specified - this may limit functionality',
        code: 'EMPTY_SCOPES',
        severity: 'warning'
      });
    }

    // Check for common problematic scopes
    const problematicScopes = scopes.filter(scope =>
      scope.includes(' ') ||
      scope.includes('\n') ||
      scope.includes('\t')
    );

    if (problematicScopes.length > 0) {
      warnings.push({
        field: 'scopes',
        message: `Scopes should not contain whitespace: ${problematicScopes.join(', ')}`,
        code: 'SCOPES_WITH_WHITESPACE',
        severity: 'warning'
      });
    }

    // Check for duplicate scopes
    const uniqueScopes = new Set(scopes);
    if (uniqueScopes.size !== scopes.length) {
      warnings.push({
        field: 'scopes',
        message: 'Duplicate scopes found - they will be deduplicated automatically',
        code: 'DUPLICATE_SCOPES',
        severity: 'warning'
      });
    }

    return warnings;
  }

  /**
   * Validate URL format and accessibility
   */
  private static validateUrl(url: string, field: string): ConfigError[] {
    const errors: ConfigError[] = [];

    try {
      const urlObj = new URL(url);

      // Check for valid protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        errors.push({
          field,
          message: `URL must use HTTP or HTTPS protocol, got ${urlObj.protocol}`,
          code: 'INVALID_URL_PROTOCOL',
          severity: 'error'
        });
      }

      // Check for empty hostname
      if (!urlObj.hostname) {
        errors.push({
          field,
          message: 'URL must have a valid hostname',
          code: 'INVALID_URL_HOSTNAME',
          severity: 'error'
        });
      }

    } catch (error) {
      errors.push({
        field,
        message: `Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'MALFORMED_URL',
        severity: 'error'
      });
    }

    return errors;
  }
}