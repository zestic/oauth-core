# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2025-01-22

### Added
- **GraphQL Integration**: Complete GraphQL schema and resolvers for OAuth flows
  - GraphQL schema with mutations for user registration and magic link authentication
  - Resolvers with comprehensive validation and error handling
  - Type-safe GraphQL context and resolver arguments
  - Integration tests for GraphQL + OAuth workflows
- **Enhanced Services**: New service layer for user registration and magic link functionality
  - `RegistrationService` for user registration with validation
  - `MagicLinkService` for magic link generation and email sending
  - Extended adapter interfaces for user and email operations
- **Comprehensive Test Coverage**: Significantly improved test coverage
  - Branch coverage increased from 74.81% to 86.76% (+11.95%)
  - Statement coverage improved to 96.74%
  - Added 100+ new test cases covering error scenarios and edge cases
  - Complete ErrorHandler test suite with 100% branch coverage

### Improved
- **Test Infrastructure**: Robust testing with comprehensive mocking
  - Enhanced PKCEManager tests (41.17% → 94.11% branch coverage)
  - Enhanced OAuthCore tests (57.69% → 88.46% branch coverage)
  - Complete StateValidator coverage (95.83% branch coverage)
  - All 373 tests passing with extensive error handling coverage
- **Code Quality**: Zero linting errors and improved TypeScript types
- **Documentation**: Enhanced with GraphQL flow documentation

### Security
- Enhanced validation in GraphQL resolvers
- Improved error handling across all components
- Comprehensive input sanitization and validation

## [0.2.0] - 2025-01-20

### Added
- New `generateAuthorizationUrl` method in OAuthCore for easier authorization URL generation
- Comprehensive test coverage for StateValidator class (41 new tests, 98.33% coverage)
- Comprehensive test coverage for FlowHandler classes (40 new tests, 100% coverage)
- Integration scenario testing for complete OAuth flows
- Enhanced error handling and edge case coverage in tests

### Improved
- Overall test coverage increased to 89.92% (significant improvement)
- Better test infrastructure with proper mocking and error simulation
- Enhanced code quality with zero linting errors
- More robust state management testing including expiry and cleanup scenarios
- Complete coverage of flow handler functionality including BaseFlowHandler, SimpleFlowHandler, and FlowHandlerFactory

### Fixed
- Minor linting issues in existing test files
- TypeScript type consistency in test mocks

## [0.1.1] - 2024-12-XX

### Added
- Initial release of @zestic/oauth-core
- OAuth2 Authorization Code Flow handler with PKCE support
- Magic Link authentication flow handler
- Framework-agnostic adapter pattern for storage, HTTP, and PKCE
- Comprehensive TypeScript type definitions
- Flow registry system for managing multiple OAuth flows
- State validation for CSRF protection
- Token management with refresh capabilities
- URL parameter parsing utilities
- Standardized error handling
- Basic test suite with mock adapters
- GitHub Actions CI/CD workflows
- ESLint and TypeScript configuration
- Documentation and contribution guidelines

### Security
- PKCE implementation for enhanced OAuth security
- State parameter validation to prevent CSRF attacks
- Secure token storage abstraction
- Parameter sanitization for logging

## [1.0.0] - TBD

Initial release with core OAuth functionality.

### Added
- Core OAuth orchestrator
- Authorization Code Flow handler
- Magic Link Flow handler
- PKCE manager
- Token manager
- State validator
- Flow registry
- TypeScript support
- Comprehensive test coverage
- Documentation
