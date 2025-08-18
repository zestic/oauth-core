/**
 * Flow-related OAuth errors
 * Handles flow detection, validation, and execution failures
 */

import { OAuthError, OAuthErrorMetadata } from './OAuthError';

export interface FlowErrorMetadata extends OAuthErrorMetadata {
  flowName?: string;
  flowType?: string;
  availableFlows?: string[];
  detectionScore?: number;
  detectionReason?: string;
  flowParameters?: Record<string, any>;
  expectedParameters?: string[];
  missingParameters?: string[];
}

/**
 * Flow error class for OAuth flow-related failures
 */
export class FlowError extends OAuthError {
  constructor(
    message: string,
    code: string,
    metadata: FlowErrorMetadata = {},
    retryable: boolean = false
  ) {
    super(message, code, 'flow', retryable, undefined, metadata);
    this.name = 'FlowError';
    Object.setPrototypeOf(this, FlowError.prototype);
  }

  /**
   * Get the flow name that caused the error
   */
  getFlowName(): string | undefined {
    return (this.metadata as FlowErrorMetadata).flowName;
  }

  /**
   * Get available flows
   */
  getAvailableFlows(): string[] | undefined {
    return (this.metadata as FlowErrorMetadata).availableFlows;
  }

  /**
   * Get detection score (if applicable)
   */
  getDetectionScore(): number | undefined {
    return (this.metadata as FlowErrorMetadata).detectionScore;
  }

  /**
   * Check if this is a flow detection error
   */
  isDetectionError(): boolean {
    return this.code === 'FLOW_DETECTION_FAILED' ||
           this.code === 'FLOW_NO_HANDLER_FOUND' ||
           this.code === 'FLOW_AMBIGUOUS_DETECTION';
  }

  /**
   * Check if this is a flow validation error
   */
  isValidationError(): boolean {
    return this.code === 'FLOW_VALIDATION_FAILED' ||
           this.code === 'FLOW_MISSING_PARAMETERS' ||
           this.code === 'FLOW_INVALID_PARAMETERS';
  }

  /**
   * Check if this is a flow execution error
   */
  isExecutionError(): boolean {
    return this.code === 'FLOW_EXECUTION_FAILED' ||
           this.code === 'FLOW_TIMEOUT' ||
           this.code === 'FLOW_INTERRUPTED';
  }

  /**
   * Get user-friendly message
   */
  getUserMessage(): string {
    const flowName = this.getFlowName();

    if (this.isDetectionError()) {
      return 'Unable to determine the appropriate authentication flow. Please try again.';
    }

    if (this.isValidationError()) {
      return flowName ?
        `Authentication flow validation failed: ${flowName}` :
        'Authentication flow validation failed. Please check your request.';
    }

    if (this.isExecutionError()) {
      return flowName ?
        `Authentication flow failed: ${flowName}` :
        'Authentication flow failed. Please try again.';
    }

    return 'Authentication flow error. Please try again.';
  }

  /**
   * Create a FlowError for no handler found
   */
  static noHandlerFound(availableFlows?: string[]): FlowError {
    const availableText = availableFlows && availableFlows.length > 0 ?
      ` Available flows: ${availableFlows.join(', ')}` : '';
    
    return new FlowError(
      `No suitable flow handler found for the provided parameters.${availableText}`,
      'FLOW_NO_HANDLER_FOUND',
      {
        availableFlows,
        detectionReason: 'No matching flow handler'
      }
    );
  }

  /**
   * Create a FlowError for unknown flow
   */
  static unknownFlow(flowName: string, availableFlows?: string[]): FlowError {
    const availableText = availableFlows && availableFlows.length > 0 ?
      ` Available flows: ${availableFlows.join(', ')}` : '';
    
    return new FlowError(
      `Unknown flow: ${flowName}.${availableText}`,
      'FLOW_UNKNOWN',
      {
        flowName,
        availableFlows
      }
    );
  }

  /**
   * Create a FlowError for flow validation failure
   */
  static validationFailed(
    flowName: string,
    reason?: string,
    missingParameters?: string[]
  ): FlowError {
    const reasonText = reason ? `: ${reason}` : '';
    const missingText = missingParameters && missingParameters.length > 0 ?
      ` Missing parameters: ${missingParameters.join(', ')}` : '';
    
    return new FlowError(
      `Flow validation failed for ${flowName}${reasonText}${missingText}`,
      'FLOW_VALIDATION_FAILED',
      {
        flowName,
        detectionReason: reason,
        missingParameters
      }
    );
  }

  /**
   * Create a FlowError for missing required parameters
   */
  static missingParameters(
    flowName: string,
    missingParameters: string[],
    expectedParameters?: string[]
  ): FlowError {
    return new FlowError(
      `Flow ${flowName} is missing required parameters: ${missingParameters.join(', ')}`,
      'FLOW_MISSING_PARAMETERS',
      {
        flowName,
        missingParameters,
        expectedParameters
      }
    );
  }

  /**
   * Create a FlowError for invalid parameters
   */
  static invalidParameters(
    flowName: string,
    invalidParameters: Record<string, any>
  ): FlowError {
    const paramNames = Object.keys(invalidParameters);
    return new FlowError(
      `Flow ${flowName} has invalid parameters: ${paramNames.join(', ')}`,
      'FLOW_INVALID_PARAMETERS',
      {
        flowName,
        flowParameters: invalidParameters,
        context: { invalidParameters }
      }
    );
  }

  /**
   * Create a FlowError for flow execution failure
   */
  static executionFailed(
    flowName: string,
    originalError?: Error,
    retryable: boolean = false
  ): FlowError {
    return new FlowError(
      `Flow execution failed: ${flowName}`,
      'FLOW_EXECUTION_FAILED',
      {
        flowName,
        originalError
      },
      retryable
    );
  }

  /**
   * Create a FlowError for flow timeout
   */
  static timeout(flowName: string, timeoutMs: number): FlowError {
    return new FlowError(
      `Flow ${flowName} timed out after ${timeoutMs}ms`,
      'FLOW_TIMEOUT',
      {
        flowName,
        context: { timeoutMs }
      },
      true // Timeouts are retryable
    );
  }

  /**
   * Create a FlowError for ambiguous flow detection
   */
  static ambiguousDetection(
    candidateFlows: Array<{ name: string; score: number; reason: string }>
  ): FlowError {
    const flowNames = candidateFlows.map(f => f.name);
    const scoresText = candidateFlows
      .map(f => `${f.name} (${f.score})`)
      .join(', ');
    
    return new FlowError(
      `Ambiguous flow detection. Multiple flows match: ${scoresText}`,
      'FLOW_AMBIGUOUS_DETECTION',
      {
        availableFlows: flowNames,
        context: { candidateFlows }
      }
    );
  }

  /**
   * Create a FlowError for disabled flow
   */
  static flowDisabled(flowName: string): FlowError {
    return new FlowError(
      `Flow ${flowName} is disabled in configuration`,
      'FLOW_DISABLED',
      {
        flowName,
        detectionReason: 'Flow disabled in configuration'
      }
    );
  }

  /**
   * Create a FlowError for flow not supported
   */
  static flowNotSupported(flowName: string, reason?: string): FlowError {
    const reasonText = reason ? `: ${reason}` : '';
    return new FlowError(
      `Flow ${flowName} is not supported${reasonText}`,
      'FLOW_NOT_SUPPORTED',
      {
        flowName,
        detectionReason: reason || 'Flow not supported'
      }
    );
  }

  /**
   * Create a FlowError for flow interrupted
   */
  static interrupted(flowName: string, reason?: string): FlowError {
    const reasonText = reason ? `: ${reason}` : '';
    return new FlowError(
      `Flow ${flowName} was interrupted${reasonText}`,
      'FLOW_INTERRUPTED',
      {
        flowName,
        detectionReason: reason
      },
      true // Interruptions are retryable
    );
  }

  /**
   * Create a FlowError for flow state error
   */
  static invalidState(flowName: string, currentState: string, expectedState: string): FlowError {
    return new FlowError(
      `Flow ${flowName} is in invalid state: ${currentState} (expected: ${expectedState})`,
      'FLOW_INVALID_STATE',
      {
        flowName,
        context: {
          currentState,
          expectedState
        }
      }
    );
  }
}
