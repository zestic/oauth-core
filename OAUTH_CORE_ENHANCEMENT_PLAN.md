# OAuth Core Enhancement Plan

## Overview

This document outlines the implementation plan for enhancing `@zestic/oauth-core` with event-driven architecture, structured error handling, automatic loading states, and advanced token management. These enhancements will significantly improve the developer experience for all platform adapters (React, Expo, Vue, Angular, etc.) while maintaining full backward compatibility.

## Goals

1. **Event-Driven Architecture** - Enable reactive state management across all platforms
2. **Structured Error Handling** - Provide rich, actionable error information
3. **Automatic Loading States** - Built-in loading state tracking for all async operations
4. **Advanced Token Management** - Automatic token refresh, expiration handling, and scheduling
5. **Authentication Status Tracking** - Centralized auth status with granular states
6. **Backward Compatibility** - All changes are additive, no breaking changes

## Implementation Phases

### Phase 1: Event System Foundation (Week 1)

#### 1.1 Event Emitter Infrastructure

**New Files:**
- `src/events/EventEmitter.ts` - Core event emitter implementation
- `src/events/OAuthEvents.ts` - OAuth-specific event types and interfaces
- `src/events/index.ts` - Event system exports

**Key Interfaces:**
```typescript
interface OAuthEventEmitter {
  on<T extends keyof OAuthEventMap>(event: T, callback: OAuthEventMap[T]): () => void;
  emit<T extends keyof OAuthEventMap>(event: T, ...args: Parameters<OAuthEventMap[T]>): void;
  off<T extends keyof OAuthEventMap>(event: T, callback: OAuthEventMap[T]): void;
  removeAllListeners(event?: keyof OAuthEventMap): void;
}

interface OAuthEventMap {
  'authStatusChange': (status: AuthStatus) => void;
  'tokenRefresh': (tokens: OAuthTokens) => void;
  'tokenExpired': (expiredTokens: OAuthTokens) => void;
  'authSuccess': (result: OAuthResult) => void;
  'authError': (error: OAuthError) => void;
  'loadingStart': (operation: string) => void;
  'loadingEnd': (operation: string) => void;
  'logout': () => void;
}
```

#### 1.2 OAuthCore Integration

**Modified Files:**
- `src/OAuthCore.ts` - Add event emitter, maintain backward compatibility

**Changes:**
```typescript
export class OAuthCore implements OAuthEventEmitter {
  private eventEmitter: EventEmitter;
  
  // Existing constructor remains unchanged
  constructor(config: OAuthConfig, adapters: OAuthAdapters) {
    // ... existing code
    this.eventEmitter = new EventEmitter();
  }
  
  // New event methods (additive only)
  on<T extends keyof OAuthEventMap>(event: T, callback: OAuthEventMap[T]): () => void {
    return this.eventEmitter.on(event, callback);
  }
  
  emit<T extends keyof OAuthEventMap>(event: T, ...args: Parameters<OAuthEventMap[T]>): void {
    this.eventEmitter.emit(event, ...args);
  }
  
  // Existing methods enhanced with events
  async generateAuthorizationUrl(additionalParams?: Record<string, string>): Promise<{ url: string; state: string }> {
    this.emit('loadingStart', 'generateAuthorizationUrl');
    try {
      const result = await this.performExistingLogic(additionalParams);
      this.emit('loadingEnd', 'generateAuthorizationUrl');
      return result;
    } catch (error) {
      this.emit('loadingEnd', 'generateAuthorizationUrl');
      this.emit('authError', this.createStructuredError(error));
      throw error;
    }
  }
}
```

### Phase 2: Structured Error System (Week 1)

#### 2.1 Error Type Hierarchy

**New Files:**
- `src/errors/OAuthError.ts` - Base OAuth error class
- `src/errors/NetworkError.ts` - Network-related errors
- `src/errors/TokenError.ts` - Token-related errors
- `src/errors/ConfigError.ts` - Configuration errors
- `src/errors/index.ts` - Error exports

**Error Classes:**
```typescript
export class OAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public type: 'network' | 'auth' | 'token' | 'config',
    public retryable: boolean = false,
    public statusCode?: number,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

export class TokenExpiredError extends OAuthError {
  constructor(expiredAt: Date, public tokens: OAuthTokens) {
    super('Access token has expired', 'TOKEN_EXPIRED', 'token', true);
    this.expiredAt = expiredAt;
  }
}

export class NetworkError extends OAuthError {
  constructor(message: string, statusCode?: number, public originalError?: Error) {
    super(message, 'NETWORK_ERROR', 'network', true, statusCode);
  }
}
```

#### 2.2 Error Integration

**Modified Files:**
- `src/OAuthCore.ts` - Replace generic Error throws with structured errors
- `src/TokenManager.ts` - Enhanced error handling
- `src/FlowHandler.ts` - Structured error responses

### Phase 3: Loading State Management (Week 2)

#### 3.1 Loading State Tracking

**New Files:**
- `src/state/LoadingManager.ts` - Centralized loading state management

**Implementation:**
```typescript
export class LoadingManager {
  private activeOperations = new Set<string>();
  
  get isLoading(): boolean {
    return this.activeOperations.size > 0;
  }
  
  startOperation(operation: string): void {
    this.activeOperations.add(operation);
  }
  
  endOperation(operation: string): void {
    this.activeOperations.delete(operation);
  }
  
  getActiveOperations(): string[] {
    return Array.from(this.activeOperations);
  }
}
```

#### 3.2 OAuthCore Loading Integration

**Modified Files:**
- `src/OAuthCore.ts` - Add loading manager, emit loading events

**New Properties:**
```typescript
export class OAuthCore {
  private loadingManager: LoadingManager;
  
  get isLoading(): boolean {
    return this.loadingManager.isLoading;
  }
  
  get activeOperations(): string[] {
    return this.loadingManager.getActiveOperations();
  }
}
```

### Phase 4: Advanced Token Management (Week 2)

#### 4.1 Token Utilities

**New Files:**
- `src/token/TokenUtils.ts` - Token expiration and validation utilities
- `src/token/TokenScheduler.ts` - Automatic token refresh scheduling

**Key Methods:**
```typescript
export class TokenUtils {
  static getExpirationTime(tokens: OAuthTokens): Date | null;
  static isTokenExpired(tokens: OAuthTokens): boolean;
  static getTimeUntilExpiration(tokens: OAuthTokens): number;
  static shouldRefreshToken(tokens: OAuthTokens, bufferMs: number = 300000): boolean;
}

export class TokenScheduler {
  private refreshTimer?: NodeJS.Timeout;
  
  scheduleRefresh(tokens: OAuthTokens, bufferMs: number, callback: () => Promise<void>): () => void;
  cancelScheduledRefresh(): void;
}
```

#### 4.2 OAuthCore Token Integration

**Modified Files:**
- `src/OAuthCore.ts` - Add token utilities and scheduling

**New Methods:**
```typescript
export class OAuthCore {
  private tokenScheduler: TokenScheduler;
  
  getTokenExpirationTime(): Date | null;
  isTokenExpired(): boolean;
  getTimeUntilExpiration(): number;
  scheduleTokenRefresh(bufferMs?: number): () => void;
  
  // Enhanced existing methods
  async refreshTokens(): Promise<OAuthResult> {
    this.emit('loadingStart', 'refreshTokens');
    try {
      const result = await this.performTokenRefresh();
      if (result.success) {
        this.emit('tokenRefresh', result.tokens);
        this.scheduleTokenRefresh(); // Auto-schedule next refresh
      }
      this.emit('loadingEnd', 'refreshTokens');
      return result;
    } catch (error) {
      this.emit('loadingEnd', 'refreshTokens');
      this.emit('authError', this.createStructuredError(error));
      throw error;
    }
  }
}
```

### Phase 5: Authentication Status Tracking (Week 3)

#### 5.1 Auth Status Management

**New Files:**
- `src/state/AuthStatusManager.ts` - Centralized auth status tracking

**Implementation:**
```typescript
export type AuthStatus = 
  | 'unauthenticated' 
  | 'authenticating' 
  | 'authenticated' 
  | 'refreshing' 
  | 'expired'
  | 'error';

export class AuthStatusManager {
  private currentStatus: AuthStatus = 'unauthenticated';
  
  get status(): AuthStatus {
    return this.currentStatus;
  }
  
  get isAuthenticated(): boolean {
    return this.currentStatus === 'authenticated';
  }
  
  setStatus(status: AuthStatus): void {
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      this.onStatusChange?.(status);
    }
  }
  
  onStatusChange?: (status: AuthStatus) => void;
}
```

#### 5.2 OAuthCore Status Integration

**Modified Files:**
- `src/OAuthCore.ts` - Add auth status manager

**New Properties:**
```typescript
export class OAuthCore {
  private authStatusManager: AuthStatusManager;
  
  get authenticationStatus(): AuthStatus {
    return this.authStatusManager.status;
  }
  
  get isAuthenticated(): boolean {
    return this.authStatusManager.isAuthenticated;
  }
}
```

### Phase 6: Configuration Validation (Week 3)

#### 6.1 Config Validation System

**New Files:**
- `src/validation/ConfigValidator.ts` - Configuration validation
- `src/validation/ValidationResult.ts` - Validation result types

**Implementation:**
```typescript
export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigError[];
  warnings: ConfigWarning[];
}

export class ConfigValidator {
  static validate(config: OAuthConfig): ConfigValidationResult;
  static validateEndpoints(endpoints: OAuthEndpoints): ValidationError[];
  static validateScopes(scopes: string[]): ValidationError[];
  static validateRedirectUri(redirectUri: string): ValidationError[];
}
```

### Phase 7: Request/Response Metadata (Week 4)

#### 7.1 Metadata System

**New Files:**
- `src/metadata/RequestMetadata.ts` - Request/response metadata tracking

**Enhanced Types:**
```typescript
export interface OAuthResult {
  // Existing fields...
  metadata?: {
    requestId?: string;
    timestamp: Date;
    duration: number;
    retryCount?: number;
    rateLimitRemaining?: number;
    rateLimitReset?: Date;
  };
}
```

## Testing Strategy

### Unit Tests
- **Event System**: Event emission, subscription, unsubscription
- **Error Handling**: Error creation, type checking, metadata
- **Loading States**: Operation tracking, state transitions
- **Token Management**: Expiration calculation, refresh scheduling
- **Auth Status**: Status transitions, validation

### Integration Tests
- **End-to-End Flows**: Complete OAuth flows with events
- **Error Scenarios**: Network failures, token expiration, invalid configs
- **Concurrent Operations**: Multiple simultaneous OAuth operations
- **Platform Compatibility**: Node.js, browser, React Native environments

### Backward Compatibility Tests
- **Existing API**: All current methods work unchanged
- **No Breaking Changes**: Existing implementations continue to work
- **Optional Features**: New features are opt-in only

## Migration Guide

### For Platform Adapter Maintainers

**No Breaking Changes Required:**
- Existing code continues to work unchanged
- New features are additive and optional
- Event listeners can be added incrementally

**Recommended Upgrades:**
1. **Add Event Listeners** for reactive state management
2. **Use Structured Errors** for better error handling
3. **Leverage Loading States** for better UX
4. **Implement Token Scheduling** for automatic refresh

**Example Migration:**
```typescript
// Before (still works)
const oauthCore = new OAuthCore(config, adapters);
const result = await oauthCore.handleCallback(params);

// After (enhanced)
const oauthCore = new OAuthCore(config, adapters);
oauthCore.on('authSuccess', (result) => updateUI(result));
oauthCore.on('authError', (error) => showError(error));
oauthCore.on('loadingStart', () => showSpinner());
const result = await oauthCore.handleCallback(params);
```

## Documentation Updates

### API Documentation
- **Event System**: Complete event reference with examples
- **Error Types**: Error hierarchy and handling patterns
- **Loading States**: Loading state management guide
- **Token Management**: Automatic refresh configuration
- **Migration Guide**: Step-by-step upgrade instructions

### Platform Guides
- **React Integration**: Event-driven hooks and components
- **Vue Integration**: Composables with reactive events
- **Angular Integration**: Services with RxJS observables
- **Expo Integration**: Mobile-specific event handling

## Release Strategy

### Version 1.0.0 (Major Release)
- **All Phase 1-7 Features**: Complete enhancement package
- **Full Backward Compatibility**: No breaking changes
- **Comprehensive Documentation**: Updated guides and examples
- **Platform Adapter Updates**: Coordinated releases

### Pre-release Testing
- **Alpha Release**: Core team testing
- **Beta Release**: Community testing with platform adapters
- **Release Candidate**: Final testing and documentation review

## Success Metrics

### Developer Experience
- **Reduced Boilerplate**: 40-60% less code in platform adapters
- **Better Error Handling**: Structured errors with actionable information
- **Automatic State Management**: Reactive updates without manual polling
- **Consistent API**: Same patterns across all platforms

### Platform Adoption
- **Easier Framework Integration**: Simplified adapter creation
- **Community Contributions**: More platform adapters from community
- **Documentation Quality**: Comprehensive guides for all platforms
- **Migration Success**: Smooth upgrades for existing users

## Implementation Checklist

### Phase 1: Event System Foundation
- [x] Create EventEmitter infrastructure
- [x] Define OAuthEventMap interface
- [x] Integrate event emitter into OAuthCore
- [x] Add event methods (on, emit, off)
- [x] Update existing methods to emit events
- [x] Write unit tests for event system
- [x] Update TypeScript definitions

### Phase 2: Structured Error System
- [x] Create OAuthError base class
- [x] Implement specific error types (NetworkError, TokenError, etc.)
- [x] Replace generic Error throws with structured errors
- [x] Add error metadata and retry logic
- [x] Update error handling in TokenManager
- [x] Write error handling tests
- [x] Document error types and codes

### Phase 3: Loading State Management
- [x] Create LoadingManager class
- [x] Integrate loading manager into OAuthCore
- [x] Add isLoading property and activeOperations
- [x] Emit loading events for all async operations
- [x] Write loading state tests
- [x] Document loading state API

### Phase 4: Advanced Token Management
- [ ] Create TokenUtils class with expiration methods
- [ ] Implement TokenScheduler for automatic refresh
- [ ] Add token utility methods to OAuthCore
- [ ] Enhance refreshTokens with auto-scheduling
- [ ] Write token management tests
- [ ] Document token management features

### Phase 5: Authentication Status Tracking
- [ ] Create AuthStatusManager class
- [ ] Define AuthStatus type with all states
- [ ] Integrate status manager into OAuthCore
- [ ] Add authenticationStatus and isAuthenticated properties
- [ ] Emit authStatusChange events
- [ ] Write auth status tests
- [ ] Document authentication status API

### Phase 6: Configuration Validation
- [ ] Create ConfigValidator class
- [ ] Implement validation methods for all config parts
- [ ] Add validateConfig method to OAuthCore
- [ ] Emit configError events for validation failures
- [ ] Write config validation tests
- [ ] Document configuration validation

### Phase 7: Request/Response Metadata
- [ ] Create RequestMetadata types
- [ ] Add metadata to OAuthResult interface
- [ ] Track request timing and retry counts
- [ ] Add rate limiting information
- [ ] Write metadata tests
- [ ] Document metadata features

### Testing & Quality Assurance
- [ ] Achieve 90%+ test coverage
- [ ] Run integration tests with existing platform adapters
- [ ] Performance testing for event system overhead
- [ ] Memory leak testing for event listeners
- [ ] Backward compatibility testing
- [ ] Cross-platform testing (Node.js, browser, React Native)

### Documentation & Examples
- [ ] Update API documentation with all new features
- [ ] Create migration guide for platform adapters
- [ ] Write integration examples for React, Vue, Angular
- [ ] Update README with new capabilities
- [ ] Create troubleshooting guide
- [ ] Record demo videos for complex features

This enhancement plan will transform oauth-core into a powerful, event-driven foundation that makes OAuth integration seamless across any JavaScript framework while maintaining complete backward compatibility.
