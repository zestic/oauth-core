# Flow Configuration Patterns

This document outlines advanced configuration patterns for OAuth flow handlers, demonstrating how to leverage the `config` parameter in flow detection and validation logic.

## Current Implementation

As of the interface fixes, all flow handlers now properly accept a `config: OAuthConfig` parameter in their `canHandle()` and `validate()` methods. This enables configuration-driven flow behavior.

### Basic Config Usage

Currently implemented in `AuthorizationCodeFlowHandler`:

```typescript
canHandle(params: URLSearchParams, config: OAuthConfig): boolean {
  // Check if this flow is explicitly disabled in config
  if (config.flows?.disabledFlows?.includes(this.name)) {
    return false;
  }

  // Standard parameter-based detection logic...
  return (
    params.has('code') &&
    !params.has('token') &&
    !params.has('magic_link_token')
  );
}
```

## Advanced Config Patterns

### 1. Detection Strategy-Based Logic

Use `config.flows?.detectionStrategy` to modify flow detection behavior:

```typescript
canHandle(params: URLSearchParams, config: OAuthConfig): boolean {
  // If explicit flow detection is configured, be more strict
  if (config.flows?.detectionStrategy === 'explicit') {
    // Only handle if this is the default flow or explicitly requested
    return config.flows?.defaultFlow === this.name;
  }
  
  // If priority-based detection, consider flow priorities more strictly
  if (config.flows?.detectionStrategy === 'priority') {
    // Could implement logic to prefer higher priority flows
    // when multiple flows could handle the same parameters
  }
  
  // Default 'auto' detection - normal parameter-based logic
  return this.standardParameterCheck(params);
}
```

### 2. Client-Specific Flow Logic

Customize flow behavior based on client characteristics:

```typescript
canHandle(params: URLSearchParams, config: OAuthConfig): boolean {
  // Mobile clients might prefer different flows
  if (config.clientId.startsWith('mobile-')) {
    if (this.name === 'authorization_code') {
      // Mobile apps might prefer magic link flows for better UX
      return false;
    }
  }
  
  // Enterprise clients might have restricted flows
  if (config.clientId.includes('enterprise')) {
    if (this.name === 'magic_link') {
      // Enterprise might require traditional OAuth flows only
      return false;
    }
  }
  
  return this.standardParameterCheck(params);
}
```

### 3. Endpoint-Specific Behavior

Adapt flow detection based on OAuth endpoints:

```typescript
canHandle(params: URLSearchParams, config: OAuthConfig): boolean {
  // Legacy endpoints might not support newer flows
  if (config.endpoints.authorization.includes('legacy')) {
    if (this.name === 'magic_link') {
      return false; // Legacy endpoints don't support magic links
    }
  }
  
  // Different environments might have different capabilities
  if (config.endpoints.token.includes('staging')) {
    // Staging might support experimental flows
    return this.experimentalParameterCheck(params);
  }
  
  return this.standardParameterCheck(params);
}
```

### 4. Enhanced Validation with Config

Use config to enable stricter validation rules:

```typescript
async validate(params: URLSearchParams, config: OAuthConfig): Promise<boolean> {
  try {
    // Basic parameter validation
    this.checkForOAuthError(params);
    this.validateRequiredParams(params, ['code']);

    // Config-based validation enhancements
    if (config.flows?.strictValidation) {
      // Require state parameter in strict mode
      if (!params.has('state')) {
        return false;
      }
      
      // Validate parameter formats more strictly
      const code = params.get('code');
      if (code && code.length < 10) {
        return false; // Codes should be at least 10 characters
      }
    }

    // Environment-specific validation
    if (config.endpoints.authorization.includes('production')) {
      // Production might require additional security checks
      return this.productionSecurityValidation(params);
    }

    return true;
  } catch {
    return false;
  }
}
```

### 5. Scope-Based Flow Selection

Consider OAuth scopes in flow detection:

```typescript
canHandle(params: URLSearchParams, config: OAuthConfig): boolean {
  // Some flows might be better suited for certain scopes
  if (config.scopes.includes('admin')) {
    if (this.name === 'magic_link') {
      // Admin operations might require traditional OAuth for audit trails
      return false;
    }
  }
  
  // Read-only scopes might prefer simpler flows
  if (config.scopes.every(scope => scope.endsWith(':read'))) {
    if (this.name === 'authorization_code') {
      // Simple read operations could use magic links
      return this.name === 'magic_link' ? true : false;
    }
  }
  
  return this.standardParameterCheck(params);
}
```

## Configuration Schema Extensions

To support these patterns, consider extending the `FlowConfiguration` interface:

```typescript
export interface FlowConfiguration {
  enabledFlows?: string[];
  disabledFlows?: string[];
  customFlows?: CallbackFlowHandler[];
  defaultFlow?: string;
  detectionStrategy?: DetectionStrategy;
  
  // New configuration options
  strictValidation?: boolean;
  clientTypeRestrictions?: {
    [clientPattern: string]: {
      allowedFlows: string[];
      deniedFlows: string[];
    };
  };
  environmentRules?: {
    [environment: string]: {
      preferredFlows: string[];
      securityLevel: 'standard' | 'strict' | 'enterprise';
    };
  };
  scopeBasedRules?: {
    [scopePattern: string]: {
      preferredFlow: string;
      fallbackFlows: string[];
    };
  };
}
```

## Implementation Guidelines

### When to Use Config-Based Logic

1. **Security Requirements**: Different environments or clients need different security levels
2. **User Experience**: Mobile vs web clients might prefer different flows
3. **Compliance**: Enterprise clients might have regulatory requirements
4. **Performance**: Some flows might be more efficient for certain use cases
5. **Feature Flags**: Gradual rollout of new flows to specific client segments

### Best Practices

1. **Fail Safe**: Always provide sensible defaults when config is missing
2. **Logging**: Log config-based decisions for debugging
3. **Testing**: Test all config combinations thoroughly
4. **Documentation**: Document config-based behavior clearly
5. **Backward Compatibility**: Ensure existing configs continue to work

### Example Test Patterns

```typescript
describe('config-based flow detection', () => {
  it('should respect disabled flows configuration', () => {
    const params = new URLSearchParams({ code: 'test-code' });
    const config = {
      ...baseConfig,
      flows: { disabledFlows: ['authorization_code'] }
    };
    
    expect(handler.canHandle(params, config)).toBe(false);
  });
  
  it('should apply client-specific restrictions', () => {
    const params = new URLSearchParams({ token: 'magic-token' });
    const config = {
      ...baseConfig,
      clientId: 'enterprise-client-123'
    };
    
    expect(magicLinkHandler.canHandle(params, config)).toBe(false);
  });
});
```

## Future Considerations

- **Dynamic Configuration**: Loading config from external sources
- **A/B Testing**: Config-driven flow experimentation
- **Analytics Integration**: Tracking config-based flow selection
- **Admin Interface**: UI for managing flow configurations
- **Configuration Validation**: Runtime validation of config schemas

## Status

- ✅ Basic disabled flows pattern implemented in `AuthorizationCodeFlowHandler`
- ⏳ Advanced patterns documented but not yet implemented
- ⏳ Other handlers (`MagicLinkFlowHandler`, etc.) need config parameter updates
- ⏳ Extended configuration schema design needed
- ⏳ Comprehensive test coverage for config patterns needed

---

*This document serves as a reference for implementing sophisticated flow configuration patterns. Patterns should be implemented incrementally based on actual requirements.*
