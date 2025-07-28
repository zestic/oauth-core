# Contributing to @zestic/oauth-core

Thank you for your interest in contributing to @zestic/oauth-core! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- Node.js 16+ (recommended: 18+)
- Yarn package manager

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/oauth-core.git
   cd oauth-core
   ```

3. Install dependencies:
   ```bash
   yarn install
   ```

4. Run tests to ensure everything works:
   ```bash
   yarn test
   ```

## Development Workflow

### Available Scripts

- `yarn build` - Build the TypeScript code
- `yarn test` - Run tests
- `yarn test:watch` - Run tests in watch mode
- `yarn test:coverage` - Run tests with coverage report
- `yarn lint` - Run ESLint
- `yarn lint:fix` - Fix ESLint issues automatically
- `yarn type-check` - Check TypeScript types without building
- `yarn ci` - Run full CI pipeline locally

### Code Style

We use ESLint and TypeScript for code quality. Please ensure your code:

- Follows the existing code style
- Passes all linting checks (`yarn lint`)
- Includes proper TypeScript types
- Has no TypeScript compilation errors

### Testing

- Write tests for all new functionality
- Ensure existing tests still pass
- Aim for high test coverage
- Use the existing test patterns and mock adapters

### Commit Messages

We follow conventional commit format:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `test:` - Test changes
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

Example: `feat: add device code flow handler`

## Pull Request Process

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit them
3. Push to your fork and create a pull request
4. Fill out the pull request template
5. Ensure all CI checks pass

### Pull Request Requirements

- [ ] All tests pass
- [ ] Code is properly linted
- [ ] TypeScript compiles without errors
- [ ] Documentation is updated if needed
- [ ] Breaking changes are clearly documented

## Project Structure

```
src/
├── core/           # Core OAuth functionality
├── flows/          # OAuth flow handlers
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── index.ts        # Main exports

tests/
├── core/           # Core functionality tests
├── flows/          # Flow handler tests
├── utils/          # Utility tests
└── mocks/          # Test mocks and helpers
```

## Adding New OAuth Flows

To add a new OAuth flow:

1. Create a new flow handler in `src/flows/`
2. Extend `BaseCallbackFlowHandler` or implement `CallbackFlowHandler` interface
3. Add comprehensive tests
4. Update the main exports
5. Document the new flow in README

Example:
```typescript
export class CustomFlowHandler extends BaseFlowHandler {
  readonly name = 'custom_flow';
  readonly priority = FLOW_PRIORITIES.NORMAL;

  canHandle(params: URLSearchParams, config: OAuthConfig): boolean {
    return params.has('custom_token');
  }

  async handle(params: URLSearchParams, adapters: OAuthAdapters, config: OAuthConfig): Promise<OAuthResult> {
    // Implementation
  }
}
```

## Reporting Issues

When reporting issues:

- Use the issue templates
- Provide minimal reproduction code
- Include environment details
- Check if the issue already exists

## Questions?

- Open a discussion on GitHub
- Check existing issues and documentation
- Review the README for usage examples

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
