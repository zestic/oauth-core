import { FlowError } from '../../src/errors/FlowError';

describe('FlowError', () => {
  describe('Basic functionality', () => {
    it('should create a FlowError with required parameters', () => {
      const error = new FlowError('Test message', 'FLOW_EXECUTION_FAILED');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FlowError);
      expect(error.name).toBe('FlowError');
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('FLOW_EXECUTION_FAILED');
      expect(error.type).toBe('flow');
    });

    it('should create a FlowError with metadata', () => {
      const metadata = {
        flowName: 'magic_link_login',
        detectionScore: 0.95,
        detectionReason: 'token parameter present',
        flowParameters: { token: 'abc123', state: 'xyz789' }
      };

      const error = new FlowError(
        'Flow execution failed',
        'FLOW_EXECUTION_FAILED',
        metadata
      );

      expect(error.message).toBe('Flow execution failed');
      expect(error.code).toBe('FLOW_EXECUTION_FAILED');
      expect(error.getFlowName()).toBe('magic_link_login');
      expect(error.getDetectionScore()).toBe(0.95);
      expect(error.getDetectionScore()).toBe(0.95);
    });

    it('should be an instance of Error', () => {
      const error = new FlowError('Test', 'FLOW_EXECUTION_FAILED');
      expect(error instanceof Error).toBe(true);
    });

    it('should check if error is execution error type', () => {
      const error = new FlowError('Execution failed', 'FLOW_EXECUTION_FAILED');
      expect(error.isExecutionError()).toBe(true);

      const otherError = new FlowError('Not found', 'FLOW_NOT_FOUND');
      expect(otherError.isExecutionError()).toBe(false);
    });

    it('should check if error is validation error type', () => {
      const error = new FlowError('Validation failed', 'FLOW_VALIDATION_FAILED');
      expect(error.isValidationError()).toBe(true);

      const otherError = new FlowError('Not found', 'FLOW_NOT_FOUND');
      expect(otherError.isValidationError()).toBe(false);
    });
  });

  describe('Static factory methods', () => {
    it('should create executionFailed error', () => {
      const originalError = new Error('Token validation failed');
      const error = FlowError.executionFailed('magic_link_login', originalError);

      expect(error.code).toBe('FLOW_EXECUTION_FAILED');
      expect(error.message).toContain('magic_link_login');
      expect(error.message).toContain('execution failed');
      expect(error.getFlowName()).toBe('magic_link_login');
    });

    it('should create validationFailed error', () => {
      const error = FlowError.validationFailed('magic_link_login', 'Missing required parameters');

      expect(error.code).toBe('FLOW_VALIDATION_FAILED');
      expect(error.message).toContain('magic_link_login');
      expect(error.message).toContain('Missing required parameters');
      expect(error.getFlowName()).toBe('magic_link_login');
    });

    it('should create unknownFlow error', () => {
      const error = FlowError.unknownFlow('unknown_flow', ['flow1', 'flow2']);

      expect(error.code).toBe('FLOW_UNKNOWN');
      expect(error.message).toContain('unknown_flow');
      expect(error.message).toContain('flow1');
      expect(error.getFlowName()).toBe('unknown_flow');
    });

    it('should create noHandlerFound error', () => {
      const error = FlowError.noHandlerFound(['flow1', 'flow2']);

      expect(error.code).toBe('FLOW_NO_HANDLER_FOUND');
      expect(error.message).toContain('No suitable flow handler');
      expect(error.message).toContain('flow1');
    });

    it('should create missingParameters error', () => {
      const error = FlowError.missingParameters('magic_link_login', ['token', 'state']);

      expect(error.code).toBe('FLOW_MISSING_PARAMETERS');
      expect(error.message).toContain('magic_link_login');
      expect(error.message).toContain('token');
      expect(error.getFlowName()).toBe('magic_link_login');
    });

    it('should create timeout error', () => {
      const error = FlowError.timeout('magic_link_login', 30000);

      expect(error.code).toBe('FLOW_TIMEOUT');
      expect(error.message).toContain('magic_link_login');
      expect(error.message).toContain('30000ms');
      expect(error.getFlowName()).toBe('magic_link_login');
    });

    it('should create ambiguousDetection error', () => {
      const candidates = [
        { name: 'flow1', score: 0.8, reason: 'reason1' },
        { name: 'flow2', score: 0.7, reason: 'reason2' }
      ];
      const error = FlowError.ambiguousDetection(candidates);

      expect(error.code).toBe('FLOW_AMBIGUOUS_DETECTION');
      expect(error.message).toContain('Ambiguous flow detection');
      expect(error.message).toContain('flow1');
      expect(error.message).toContain('flow2');
    });

    it('should create flowDisabled error', () => {
      const error = FlowError.flowDisabled('disabled_flow');

      expect(error.code).toBe('FLOW_DISABLED');
      expect(error.message).toContain('disabled_flow');
      expect(error.message).toContain('disabled');
      expect(error.getFlowName()).toBe('disabled_flow');
    });

    it('should create flowNotSupported error', () => {
      const error = FlowError.flowNotSupported('unsupported_flow', 'Not implemented');

      expect(error.code).toBe('FLOW_NOT_SUPPORTED');
      expect(error.message).toContain('unsupported_flow');
      expect(error.message).toContain('Not implemented');
      expect(error.getFlowName()).toBe('unsupported_flow');
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const error = new FlowError('Test message', 'FLOW_EXECUTION_FAILED', {
        flowName: 'magic_link_login',
        detectionScore: 0.95
      });

      const json = error.toJSON();

      expect(json.name).toBe('FlowError');
      expect(json.message).toBe('Test message');
      expect(json.code).toBe('FLOW_EXECUTION_FAILED');
      expect(json.type).toBe('flow');
    });
  });
});
