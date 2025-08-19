import { ConfigError } from '../../src/errors/ConfigError';

describe('ConfigError', () => {
  describe('Basic functionality', () => {
    it('should create a ConfigError with required parameters', () => {
      const error = new ConfigError('Test message', 'CONFIG_INVALID_VALUE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConfigError);
      expect(error.name).toBe('ConfigError');
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('CONFIG_INVALID_VALUE');
      expect(error.type).toBe('config');
    });

    it('should create a ConfigError with metadata', () => {
      const metadata = {
        configField: 'clientId',
        configPath: 'oauth.clientId',
        expectedType: 'string',
        actualType: 'undefined'
      };

      const error = new ConfigError(
        'Invalid client ID',
        'CONFIG_MISSING_FIELD',
        metadata
      );

      expect(error.message).toBe('Invalid client ID');
      expect(error.code).toBe('CONFIG_MISSING_FIELD');
      expect(error.getConfigField()).toBe('clientId');
      expect(error.getConfigPath()).toBe('oauth.clientId');
    });

    it('should be an instance of Error', () => {
      const error = new ConfigError('Test', 'CONFIG_INVALID_VALUE');
      expect(error instanceof Error).toBe(true);
    });

    it('should check if error is missing field type', () => {
      const error = new ConfigError('Missing field', 'CONFIG_MISSING_FIELD');
      expect(error.isMissingField()).toBe(true);

      const otherError = new ConfigError('Invalid type', 'CONFIG_INVALID_TYPE');
      expect(otherError.isMissingField()).toBe(false);
    });

    it('should check if error is invalid value type', () => {
      const error = new ConfigError('Invalid type', 'CONFIG_INVALID_TYPE');
      expect(error.isInvalidValue()).toBe(true);

      const otherError = new ConfigError('Missing field', 'CONFIG_MISSING_FIELD');
      expect(otherError.isInvalidValue()).toBe(false);
    });
  });

  describe('Static factory methods', () => {
    it('should create missingRequiredField error', () => {
      const error = ConfigError.missingRequiredField('clientId', 'oauth.clientId');

      expect(error.code).toBe('CONFIG_REQUIRED_FIELD_MISSING');
      expect(error.message).toContain('clientId');
      expect(error.message).toContain('required');
      expect(error.getConfigField()).toBe('clientId');
      expect(error.getConfigPath()).toBe('oauth.clientId');
    });

    it('should create invalidFieldType error', () => {
      const error = ConfigError.invalidFieldType('timeout', 'number', 'string', 'oauth.timeout');

      expect(error.code).toBe('CONFIG_INVALID_TYPE');
      expect(error.message).toContain('timeout');
      expect(error.message).toContain('number');
      expect(error.message).toContain('string');
      expect(error.getConfigField()).toBe('timeout');
      expect(error.getConfigPath()).toBe('oauth.timeout');
    });

    it('should create invalidFieldValue error', () => {
      const error = ConfigError.invalidFieldValue('grantType', 'invalid', ['authorization_code', 'refresh_token'], 'oauth.grantType');

      expect(error.code).toBe('CONFIG_INVALID_VALUE');
      expect(error.message).toContain('grantType');
      expect(error.message).toContain('invalid');
      expect(error.message).toContain('authorization_code');
      expect(error.getConfigField()).toBe('grantType');
    });

    it('should create invalidUrl error', () => {
      const error = ConfigError.invalidUrl('redirectUri', 'invalid-url', 'oauth.redirectUri');

      expect(error.code).toBe('CONFIG_INVALID_URL');
      expect(error.message).toContain('redirectUri');
      expect(error.message).toContain('invalid-url');
      expect(error.getConfigField()).toBe('redirectUri');
    });

    it('should create invalidScope error with valid scopes', () => {
      const error = ConfigError.invalidScope('invalid-scope', ['read', 'write']);

      expect(error.code).toBe('CONFIG_INVALID_SCOPE');
      expect(error.message).toContain('invalid-scope');
      expect(error.message).toContain('read');
      expect(error.message).toContain('write');
    });

    it('should create invalidScope error without valid scopes', () => {
      const error = ConfigError.invalidScope('invalid-scope');

      expect(error.code).toBe('CONFIG_INVALID_SCOPE');
      expect(error.message).toContain('invalid-scope');
    });

    it('should create missingClientId error', () => {
      const error = ConfigError.missingClientId();

      expect(error.code).toBe('CONFIG_REQUIRED_FIELD_MISSING');
      expect(error.message).toContain('clientId');
      expect(error.getConfigField()).toBe('clientId');
    });

    it('should create missingRedirectUri error', () => {
      const error = ConfigError.missingRedirectUri();

      expect(error.code).toBe('CONFIG_REQUIRED_FIELD_MISSING');
      expect(error.message).toContain('redirectUri');
      expect(error.getConfigField()).toBe('redirectUri');
    });

    it('should create missingEndpoints error', () => {
      const error = ConfigError.missingEndpoints();

      expect(error.code).toBe('CONFIG_REQUIRED_FIELD_MISSING');
      expect(error.message).toContain('endpoints');
      expect(error.getConfigField()).toBe('endpoints');
    });

    it('should create missingAuthorizationEndpoint error', () => {
      const error = ConfigError.missingAuthorizationEndpoint();

      expect(error.code).toBe('CONFIG_REQUIRED_FIELD_MISSING');
      expect(error.message).toContain('authorization');
      expect(error.getConfigField()).toBe('authorization');
    });

    it('should create missingTokenEndpoint error', () => {
      const error = ConfigError.missingTokenEndpoint();

      expect(error.code).toBe('CONFIG_REQUIRED_FIELD_MISSING');
      expect(error.message).toContain('token');
      expect(error.getConfigField()).toBe('token');
    });

    it('should create invalidRedirectUri error', () => {
      const error = ConfigError.invalidRedirectUri('invalid-url');

      expect(error.code).toBe('CONFIG_INVALID_URL');
      expect(error.message).toContain('invalid-url');
      expect(error.getConfigField()).toBe('redirectUri');
    });
  });

  describe('User-friendly messages', () => {
    it('should return user message for missing field with field name', () => {
      const error = new ConfigError('Missing field', 'CONFIG_REQUIRED_FIELD_MISSING', {
        configField: 'clientId'
      });

      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Missing required configuration: clientId');
    });

    it('should return user message for missing field without field name', () => {
      const error = new ConfigError('Missing field', 'CONFIG_REQUIRED_FIELD_MISSING');

      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Missing required configuration. Please check your settings.');
    });

    it('should return user message for invalid value with field name', () => {
      const error = new ConfigError('Invalid value', 'CONFIG_INVALID_VALUE', {
        configField: 'timeout'
      });

      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Invalid configuration value for: timeout');
    });

    it('should return user message for invalid value without field name', () => {
      const error = new ConfigError('Invalid value', 'CONFIG_INVALID_VALUE');

      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Invalid configuration value. Please check your settings.');
    });

    it('should return user message for validation error', () => {
      const error = new ConfigError('Validation failed', 'CONFIG_VALIDATION_FAILED');

      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Configuration validation failed. Please check your settings.');
    });

    it('should return generic user message for unknown error', () => {
      const error = new ConfigError('Unknown error', 'CONFIG_UNKNOWN_ERROR' as any);

      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Configuration error. Please contact support.');
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const error = new ConfigError('Test message', 'CONFIG_INVALID_VALUE', {
        configField: 'clientId',
        configPath: 'oauth.clientId'
      });

      const json = error.toJSON();

      expect(json.name).toBe('ConfigError');
      expect(json.message).toBe('Test message');
      expect(json.code).toBe('CONFIG_INVALID_VALUE');
      expect(json.type).toBe('config');
    });
  });
});
