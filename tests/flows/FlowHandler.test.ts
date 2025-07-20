import { BaseFlowHandler, SimpleFlowHandler, FlowHandlerFactory } from '../../src/flows/FlowHandler';
import { OAuthConfig, OAuthAdapters, OAuthResult, OAuthError } from '../../src/types/OAuthTypes';
import { createMockAdapters, createMockConfig } from '../mocks/adapters';

// Concrete implementation for testing BaseFlowHandler
class TestFlowHandler extends BaseFlowHandler {
  readonly name = 'test_flow';
  readonly priority = 50;

  canHandle(params: URLSearchParams): boolean {
    return params.has('test_param');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handle(params: URLSearchParams, _adapters: OAuthAdapters, _config: OAuthConfig): Promise<OAuthResult> {
    this.checkForOAuthError(params);
    this.validateRequiredParams(params, ['test_param']);

    // Validate that parameters can be retrieved
    this.getRequiredParam(params, 'test_param');
    this.getOptionalParam(params, 'optional_param', 'default_value');

    return this.createSuccessResult('test-access-token', 'test-refresh-token', 3600);
  }

  async validate(params: URLSearchParams): Promise<boolean> {
    return params.has('test_param');
  }
}

describe('BaseFlowHandler', () => {
  let handler: TestFlowHandler;
  let mockAdapters: ReturnType<typeof createMockAdapters>;
  let mockConfig: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    handler = new TestFlowHandler();
    mockAdapters = createMockAdapters();
    mockConfig = createMockConfig();
    
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('checkForOAuthError', () => {
    it('should not throw for parameters without errors', () => {
      const params = new URLSearchParams({ test_param: 'value' });
      
      expect(() => handler['checkForOAuthError'](params)).not.toThrow();
    });

    it('should throw for OAuth error parameters', () => {
      const params = new URLSearchParams({
        error: 'access_denied',
        error_description: 'User denied access'
      });
      
      expect(() => handler['checkForOAuthError'](params)).toThrow(OAuthError);
    });

    it('should throw for OAuth error without description', () => {
      const params = new URLSearchParams({ error: 'invalid_request' });
      
      expect(() => handler['checkForOAuthError'](params)).toThrow(OAuthError);
    });

    it('should handle unknown error codes', () => {
      const params = new URLSearchParams({ error: 'unknown_error' });
      
      expect(() => handler['checkForOAuthError'](params)).toThrow(OAuthError);
    });
  });

  describe('validateRequiredParams', () => {
    it('should not throw when all required params are present', () => {
      const params = new URLSearchParams({
        param1: 'value1',
        param2: 'value2',
        param3: 'value3'
      });
      
      expect(() => handler['validateRequiredParams'](params, ['param1', 'param2']))
        .not.toThrow();
    });

    it('should throw when required params are missing', () => {
      const params = new URLSearchParams({ param1: 'value1' });
      
      expect(() => handler['validateRequiredParams'](params, ['param1', 'param2', 'param3']))
        .toThrow(OAuthError);
    });

    it('should handle empty required params array', () => {
      const params = new URLSearchParams();
      
      expect(() => handler['validateRequiredParams'](params, []))
        .not.toThrow();
    });
  });

  describe('getRequiredParam', () => {
    it('should return parameter value when present', () => {
      const params = new URLSearchParams({ test_param: 'test_value' });
      
      const value = handler['getRequiredParam'](params, 'test_param');
      expect(value).toBe('test_value');
    });

    it('should throw when parameter is missing', () => {
      const params = new URLSearchParams();
      
      expect(() => handler['getRequiredParam'](params, 'missing_param'))
        .toThrow(OAuthError);
    });

    it('should throw when parameter is empty string', () => {
      const params = new URLSearchParams({ empty_param: '' });
      
      expect(() => handler['getRequiredParam'](params, 'empty_param'))
        .toThrow(OAuthError);
    });
  });

  describe('getOptionalParam', () => {
    it('should return parameter value when present', () => {
      const params = new URLSearchParams({ optional_param: 'optional_value' });
      
      const value = handler['getOptionalParam'](params, 'optional_param');
      expect(value).toBe('optional_value');
    });

    it('should return undefined when parameter is missing and no default', () => {
      const params = new URLSearchParams();
      
      const value = handler['getOptionalParam'](params, 'missing_param');
      expect(value).toBeUndefined();
    });

    it('should return default value when parameter is missing', () => {
      const params = new URLSearchParams();
      
      const value = handler['getOptionalParam'](params, 'missing_param', 'default_value');
      expect(value).toBe('default_value');
    });

    it('should return parameter value over default when present', () => {
      const params = new URLSearchParams({ present_param: 'actual_value' });
      
      const value = handler['getOptionalParam'](params, 'present_param', 'default_value');
      expect(value).toBe('actual_value');
    });
  });

  describe('createSuccessResult', () => {
    it('should create success result with all parameters', () => {
      const result = handler['createSuccessResult']('access-token', 'refresh-token', 3600);
      
      expect(result).toEqual({
        success: true,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600
      });
    });

    it('should create success result with minimal parameters', () => {
      const result = handler['createSuccessResult']('access-token');
      
      expect(result).toEqual({
        success: true,
        accessToken: 'access-token',
        refreshToken: undefined,
        expiresIn: undefined
      });
    });
  });

  describe('createErrorResult', () => {
    it('should create error result with error code', () => {
      const result = handler['createErrorResult']('Test error', 'test_error_code');
      
      expect(result).toEqual({
        success: false,
        error: 'Test error',
        errorCode: 'test_error_code'
      });
    });

    it('should create error result without error code', () => {
      const result = handler['createErrorResult']('Test error');
      
      expect(result).toEqual({
        success: false,
        error: 'Test error',
        errorCode: undefined
      });
    });
  });

  describe('logFlowExecution', () => {
    it('should log message without parameters', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      handler['logFlowExecution']('Test message');
      
      expect(consoleSpy).toHaveBeenCalledWith('[test_flow] Test message', {});
    });

    it('should log message with sanitized parameters', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      const params = new URLSearchParams({
        safe_param: 'safe_value',
        code: 'sensitive_code',
        access_token: 'sensitive_token'
      });
      
      handler['logFlowExecution']('Test message', params);
      
      expect(consoleSpy).toHaveBeenCalledWith('[test_flow] Test message', expect.any(Object));
    });
  });

  describe('measureExecutionTime', () => {
    it('should measure successful operation time', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      const operation = jest.fn().mockResolvedValue('success');

      const result = await handler['measureExecutionTime'](operation, 'test operation');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[test_flow\] test operation completed in \d+ms/)
      );
    });

    it('should measure failed operation time', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error');
      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(handler['measureExecutionTime'](operation, 'test operation'))
        .rejects.toThrow('Operation failed');

      expect(operation).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[test_flow\] test operation failed after \d+ms:/),
        error
      );
    });
  });

  describe('integration with handle method', () => {
    it('should handle successful flow execution', async () => {
      const params = new URLSearchParams({ test_param: 'test_value' });

      const result = await handler.handle(params, mockAdapters, mockConfig);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBe('test-refresh-token');
      expect(result.expiresIn).toBe(3600);
    });

    it('should handle OAuth errors in flow execution', async () => {
      const params = new URLSearchParams({
        error: 'access_denied',
        error_description: 'User denied access'
      });

      await expect(handler.handle(params, mockAdapters, mockConfig))
        .rejects.toThrow(OAuthError);
    });

    it('should handle missing required parameters', async () => {
      const params = new URLSearchParams(); // Missing test_param

      await expect(handler.handle(params, mockAdapters, mockConfig))
        .rejects.toThrow(OAuthError);
    });
  });
});

describe('SimpleFlowHandler', () => {
  let mockAdapters: ReturnType<typeof createMockAdapters>;
  let mockConfig: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    mockAdapters = createMockAdapters();
    mockConfig = createMockConfig();
  });

  describe('constructor and basic functionality', () => {
    it('should create handler with all functions', () => {
      const canHandleFunc = jest.fn().mockReturnValue(true);
      const handleFunc = jest.fn().mockResolvedValue({ success: true, accessToken: 'token' });
      const validateFunc = jest.fn().mockResolvedValue(true);

      const handler = new SimpleFlowHandler(
        'simple_test',
        25,
        canHandleFunc,
        handleFunc,
        validateFunc
      );

      expect(handler.name).toBe('simple_test');
      expect(handler.priority).toBe(25);
    });

    it('should create handler without validate function', () => {
      const canHandleFunc = jest.fn().mockReturnValue(true);
      const handleFunc = jest.fn().mockResolvedValue({ success: true, accessToken: 'token' });

      const handler = new SimpleFlowHandler('simple_test', 25, canHandleFunc, handleFunc);

      expect(handler.name).toBe('simple_test');
      expect(handler.priority).toBe(25);
    });
  });

  describe('canHandle', () => {
    it('should call provided canHandle function', () => {
      const canHandleFunc = jest.fn().mockReturnValue(true);
      const handleFunc = jest.fn();
      const handler = new SimpleFlowHandler('test', 25, canHandleFunc, handleFunc);
      const params = new URLSearchParams({ test: 'value' });

      const result = handler.canHandle(params, mockConfig);

      expect(result).toBe(true);
      expect(canHandleFunc).toHaveBeenCalledWith(params, mockConfig);
    });

    it('should return false when canHandle function returns false', () => {
      const canHandleFunc = jest.fn().mockReturnValue(false);
      const handleFunc = jest.fn();
      const handler = new SimpleFlowHandler('test', 25, canHandleFunc, handleFunc);
      const params = new URLSearchParams();

      const result = handler.canHandle(params, mockConfig);

      expect(result).toBe(false);
      expect(canHandleFunc).toHaveBeenCalledWith(params, mockConfig);
    });
  });

  describe('handle', () => {
    it('should call provided handle function', async () => {
      const expectedResult = { success: true, accessToken: 'test-token' };
      const canHandleFunc = jest.fn().mockReturnValue(true);
      const handleFunc = jest.fn().mockResolvedValue(expectedResult);
      const handler = new SimpleFlowHandler('test', 25, canHandleFunc, handleFunc);
      const params = new URLSearchParams({ test: 'value' });

      const result = await handler.handle(params, mockAdapters, mockConfig);

      expect(result).toBe(expectedResult);
      expect(handleFunc).toHaveBeenCalledWith(params, mockAdapters, mockConfig);
    });

    it('should propagate errors from handle function', async () => {
      const error = new Error('Handle failed');
      const canHandleFunc = jest.fn().mockReturnValue(true);
      const handleFunc = jest.fn().mockRejectedValue(error);
      const handler = new SimpleFlowHandler('test', 25, canHandleFunc, handleFunc);
      const params = new URLSearchParams();

      await expect(handler.handle(params, mockAdapters, mockConfig))
        .rejects.toThrow('Handle failed');
    });
  });

  describe('validate', () => {
    it('should call provided validate function', async () => {
      const canHandleFunc = jest.fn().mockReturnValue(true);
      const handleFunc = jest.fn();
      const validateFunc = jest.fn().mockResolvedValue(true);
      const handler = new SimpleFlowHandler('test', 25, canHandleFunc, handleFunc, validateFunc);
      const params = new URLSearchParams({ test: 'value' });

      const result = await handler.validate(params, mockConfig);

      expect(result).toBe(true);
      expect(validateFunc).toHaveBeenCalledWith(params, mockConfig);
    });

    it('should return true when no validate function provided', async () => {
      const canHandleFunc = jest.fn().mockReturnValue(true);
      const handleFunc = jest.fn();
      const handler = new SimpleFlowHandler('test', 25, canHandleFunc, handleFunc);
      const params = new URLSearchParams();

      const result = await handler.validate(params, mockConfig);

      expect(result).toBe(true);
    });

    it('should return false when validate function returns false', async () => {
      const canHandleFunc = jest.fn().mockReturnValue(true);
      const handleFunc = jest.fn();
      const validateFunc = jest.fn().mockResolvedValue(false);
      const handler = new SimpleFlowHandler('test', 25, canHandleFunc, handleFunc, validateFunc);
      const params = new URLSearchParams();

      const result = await handler.validate(params, mockConfig);

      expect(result).toBe(false);
    });

    it('should propagate errors from validate function', async () => {
      const error = new Error('Validation failed');
      const canHandleFunc = jest.fn().mockReturnValue(true);
      const handleFunc = jest.fn();
      const validateFunc = jest.fn().mockRejectedValue(error);
      const handler = new SimpleFlowHandler('test', 25, canHandleFunc, handleFunc, validateFunc);
      const params = new URLSearchParams();

      await expect(handler.validate(params, mockConfig))
        .rejects.toThrow('Validation failed');
    });
  });
});

describe('FlowHandlerFactory', () => {
  let mockAdapters: ReturnType<typeof createMockAdapters>;
  let mockConfig: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    mockAdapters = createMockAdapters();
    mockConfig = createMockConfig();
  });

  describe('create', () => {
    it('should create handler with all functions', () => {
      const canHandleFunc = jest.fn().mockReturnValue(true);
      const handleFunc = jest.fn().mockResolvedValue({ success: true, accessToken: 'token' });
      const validateFunc = jest.fn().mockResolvedValue(true);

      const handler = FlowHandlerFactory.create(
        'factory_test',
        30,
        canHandleFunc,
        handleFunc,
        validateFunc
      );

      expect(handler.name).toBe('factory_test');
      expect(handler.priority).toBe(30);
      expect(handler).toBeInstanceOf(SimpleFlowHandler);
    });

    it('should create handler without validate function', () => {
      const canHandleFunc = jest.fn().mockReturnValue(true);
      const handleFunc = jest.fn().mockResolvedValue({ success: true, accessToken: 'token' });

      const handler = FlowHandlerFactory.create('factory_test', 30, canHandleFunc, handleFunc);

      expect(handler.name).toBe('factory_test');
      expect(handler.priority).toBe(30);
      expect(handler).toBeInstanceOf(SimpleFlowHandler);
    });

    it('should create functional handler', async () => {
      const canHandleFunc = (params: URLSearchParams) => params.has('factory_param');
      const handleFunc = async () => ({ success: true, accessToken: 'factory-token' });
      const validateFunc = async () => true;

      const handler = FlowHandlerFactory.create(
        'factory_functional',
        40,
        canHandleFunc,
        handleFunc,
        validateFunc
      );

      const params = new URLSearchParams({ factory_param: 'value' });

      expect(handler.canHandle(params, mockConfig)).toBe(true);
      expect(await handler.validate!(params, mockConfig)).toBe(true);

      const result = await handler.handle(params, mockAdapters, mockConfig);
      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('factory-token');
    });

    it('should create handler that properly rejects invalid params', async () => {
      const canHandleFunc = (params: URLSearchParams) => params.has('required_param');
      const handleFunc = async () => ({ success: true, accessToken: 'token' });

      const handler = FlowHandlerFactory.create('factory_reject', 50, canHandleFunc, handleFunc);

      const validParams = new URLSearchParams({ required_param: 'value' });
      const invalidParams = new URLSearchParams({ other_param: 'value' });

      expect(handler.canHandle(validParams, mockConfig)).toBe(true);
      expect(handler.canHandle(invalidParams, mockConfig)).toBe(false);
    });
  });
});
