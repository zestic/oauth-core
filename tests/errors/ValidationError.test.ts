import { ValidationError } from '../../src/errors/ValidationError';

describe('ValidationError', () => {
  describe('Basic functionality', () => {
    it('should create a ValidationError with required parameters', () => {
      const error = new ValidationError('Test message', 'VALIDATION_MISSING_PARAMETER');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('VALIDATION_MISSING_PARAMETER');
      expect(error.type).toBe('validation');
    });

    it('should create a ValidationError with metadata', () => {
      const metadata = {
        parameterName: 'clientId',
        expectedValue: 'string',
        actualValue: null,
        validationRule: 'required',
        allowedValues: ['value1', 'value2']
      };

      const error = new ValidationError(
        'Invalid parameter',
        'VALIDATION_INVALID_PARAMETER',
        metadata
      );

      expect(error.message).toBe('Invalid parameter');
      expect(error.code).toBe('VALIDATION_INVALID_PARAMETER');
      expect(error.getParameterName()).toBe('clientId');
      expect(error.getValidationRule()).toBe('required');
    });

    it('should be an instance of Error', () => {
      const error = new ValidationError('Test', 'VALIDATION_MISSING_PARAMETER');
      expect(error instanceof Error).toBe(true);
    });

    it('should check if error is missing parameter type', () => {
      const error = new ValidationError('Missing parameter', 'VALIDATION_MISSING_PARAMETER');
      expect(error.isMissingParameter()).toBe(true);

      const otherError = new ValidationError('Invalid format', 'VALIDATION_INVALID_FORMAT');
      expect(otherError.isMissingParameter()).toBe(false);
    });

    it('should check if error is invalid parameter type', () => {
      const error = new ValidationError('Invalid format', 'VALIDATION_INVALID_FORMAT');
      expect(error.isInvalidParameter()).toBe(true);

      const otherError = new ValidationError('Missing parameter', 'VALIDATION_MISSING_PARAMETER');
      expect(otherError.isInvalidParameter()).toBe(false);
    });
  });

  describe('Static factory methods', () => {
    it('should create missingRequiredParameter error', () => {
      const error = ValidationError.missingRequiredParameter('clientId');

      expect(error.code).toBe('VALIDATION_REQUIRED_PARAMETER_MISSING');
      expect(error.message).toContain('clientId');
      expect(error.message).toContain('required');
      expect(error.getParameterName()).toBe('clientId');
    });

    it('should create invalidParameterFormat error', () => {
      const error = ValidationError.invalidParameterFormat('email', 'valid email format', 'invalid-email');

      expect(error.code).toBe('VALIDATION_INVALID_FORMAT');
      expect(error.message).toContain('email');
      expect(error.message).toContain('valid email format');
      expect(error.message).toContain('expected');
      expect(error.getParameterName()).toBe('email');
    });

    it('should create invalidParameterType error', () => {
      const error = ValidationError.invalidParameterType('timeout', 'number', 'string value');

      expect(error.code).toBe('VALIDATION_INVALID_TYPE');
      expect(error.message).toContain('timeout');
      expect(error.message).toContain('number');
      expect(error.message).toContain('string');
      expect(error.getParameterName()).toBe('timeout');
    });

    it('should create stateMismatch error', () => {
      const error = ValidationError.stateMismatch('expected123', 'actual456');

      expect(error.code).toBe('VALIDATION_STATE_MISMATCH');
      expect(error.message).toContain('state parameter mismatch');
      expect(error.message).toContain('CSRF');
      expect(error.getParameterName()).toBe('state');
    });

    it('should create missingState error', () => {
      const error = ValidationError.missingState();

      expect(error.code).toBe('VALIDATION_MISSING_STATE');
      expect(error.message).toContain('Missing OAuth state parameter');
      expect(error.getParameterName()).toBe('state');
    });

    it('should create invalidUrl error', () => {
      const error = ValidationError.invalidUrl('redirectUri', 'invalid-url');

      expect(error.code).toBe('VALIDATION_INVALID_URL');
      expect(error.message).toContain('redirectUri');
      expect(error.message).toContain('invalid-url');
      expect(error.getParameterName()).toBe('redirectUri');
    });

    it('should create invalidCodeChallengeMethod error', () => {
      const error = ValidationError.invalidCodeChallengeMethod('MD5');

      expect(error.code).toBe('VALIDATION_INVALID_VALUE');
      expect(error.message).toContain('MD5');
      expect(error.message).toContain('S256');
      expect(error.getParameterName()).toBe('code_challenge_method');
    });

    it('should create invalidGrantType error', () => {
      const error = ValidationError.invalidGrantType('invalid_grant');

      expect(error.code).toBe('VALIDATION_INVALID_VALUE');
      expect(error.message).toContain('invalid_grant');
      expect(error.message).toContain('authorization_code');
      expect(error.getParameterName()).toBe('grant_type');
    });

    it('should create parameterTooLong error', () => {
      const error = ValidationError.parameterTooLong('description', 300, 255);

      expect(error.code).toBe('VALIDATION_PARAMETER_TOO_LONG');
      expect(error.message).toContain('description');
      expect(error.message).toContain('300');
      expect(error.message).toContain('255');
      expect(error.getParameterName()).toBe('description');
    });

    it('should create parameterTooShort error', () => {
      const error = ValidationError.parameterTooShort('password', 3, 8);

      expect(error.code).toBe('VALIDATION_PARAMETER_TOO_SHORT');
      expect(error.message).toContain('password');
      expect(error.message).toContain('3');
      expect(error.message).toContain('8');
      expect(error.getParameterName()).toBe('password');
    });
  });

  describe('User-friendly messages', () => {
    it('should return user message for missing parameter with parameter name', () => {
      const error = new ValidationError('Missing parameter', 'VALIDATION_REQUIRED_PARAMETER_MISSING', {
        parameterName: 'clientId'
      });

      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Missing required parameter: clientId');
    });

    it('should return user message for missing parameter without parameter name', () => {
      const error = new ValidationError('Missing parameter', 'VALIDATION_REQUIRED_PARAMETER_MISSING');

      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Missing required parameter. Please check your request.');
    });

    it('should return user message for invalid parameter with parameter name', () => {
      const error = new ValidationError('Invalid parameter', 'VALIDATION_INVALID_PARAMETER', {
        parameterName: 'grantType'
      });

      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Invalid parameter value: grantType');
    });

    it('should return user message for invalid parameter without parameter name', () => {
      const error = new ValidationError('Invalid parameter', 'VALIDATION_INVALID_PARAMETER');

      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Invalid parameter value. Please check your request.');
    });

    it('should return user message for state validation error', () => {
      const error = new ValidationError('State mismatch', 'VALIDATION_STATE_MISMATCH');

      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Security validation failed. Please try again.');
    });

    it('should return generic user message for unknown error', () => {
      const error = new ValidationError('Unknown error', 'VALIDATION_UNKNOWN_ERROR' as any);

      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Request validation failed. Please check your parameters.');
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const error = new ValidationError('Test message', 'VALIDATION_MISSING_PARAMETER', {
        parameterName: 'clientId',
        expectedValue: 'string',
        actualValue: null
      });

      const json = error.toJSON();

      expect(json.name).toBe('ValidationError');
      expect(json.message).toBe('Test message');
      expect(json.code).toBe('VALIDATION_MISSING_PARAMETER');
      expect(json.type).toBe('validation');
    });
  });
});
