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
