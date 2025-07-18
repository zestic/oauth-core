# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Comprehensive test suite with mock adapters
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
