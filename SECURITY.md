# Security Policy

## Supported Versions

We actively support the following versions of @zestic/oauth-core with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability in @zestic/oauth-core, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing: **security@zestic.com**

Include the following information in your report:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if you have one)
- Your contact information

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours.
- **Initial Assessment**: We will provide an initial assessment within 5 business days.
- **Updates**: We will keep you informed of our progress throughout the investigation.
- **Resolution**: We aim to resolve critical vulnerabilities within 30 days.

### Responsible Disclosure

We follow responsible disclosure practices:

1. We will work with you to understand and resolve the issue
2. We will not take legal action against researchers who:
   - Report vulnerabilities responsibly
   - Do not access or modify user data
   - Do not disrupt our services
3. We will publicly acknowledge your contribution (unless you prefer to remain anonymous)

## Security Best Practices

When using @zestic/oauth-core:

### For Developers

- **Always validate state parameters** to prevent CSRF attacks
- **Use HTTPS** for all OAuth redirects and token exchanges
- **Store tokens securely** using appropriate storage mechanisms
- **Implement proper error handling** to avoid information leakage
- **Keep dependencies updated** to get security patches
- **Use strong random values** for state and PKCE parameters

### For Production Deployments

- **Enable PKCE** for all OAuth flows when possible
- **Validate redirect URIs** strictly on your authorization server
- **Use short token expiration times** and implement refresh token rotation
- **Monitor for suspicious OAuth activity**
- **Implement rate limiting** on OAuth endpoints
- **Log security events** for audit purposes

### Configuration Security

```typescript
// ✅ Good: Secure configuration
const config = {
  clientId: process.env.OAUTH_CLIENT_ID, // From environment
  endpoints: {
    authorization: 'https://secure-auth.example.com/oauth/authorize',
    token: 'https://secure-auth.example.com/oauth/token',
    revocation: 'https://secure-auth.example.com/oauth/revoke',
  },
  redirectUri: 'https://yourapp.com/auth/callback', // HTTPS only
  scopes: ['read', 'write'], // Minimal required scopes
};

// ❌ Bad: Insecure configuration
const config = {
  clientId: 'hardcoded-client-id', // Hardcoded secrets
  endpoints: {
    authorization: 'http://insecure-auth.example.com/oauth/authorize', // HTTP
    // ... other insecure settings
  },
  redirectUri: 'http://localhost:3000/callback', // HTTP in production
  scopes: ['*'], // Overly broad scopes
};
```

## Security Features

@zestic/oauth-core includes several security features:

- **PKCE Support**: Built-in PKCE implementation for enhanced security
- **State Validation**: Automatic CSRF protection with state parameters
- **Secure Token Storage**: Pluggable storage adapters for secure token management
- **Error Handling**: Standardized error handling that doesn't leak sensitive information
- **Parameter Sanitization**: Automatic sanitization of sensitive parameters in logs

## Known Security Considerations

- This library handles sensitive OAuth tokens and credentials
- Proper storage adapter implementation is crucial for security
- Network communication should always use HTTPS in production
- State parameters must be properly validated to prevent CSRF attacks
- Token storage should be appropriate for your deployment environment

## Updates and Patches

- Security updates will be released as patch versions
- Critical security issues will be addressed with emergency releases
- Subscribe to GitHub releases to stay informed about security updates
- Review the CHANGELOG for security-related changes

## Contact

For security-related questions or concerns:
- Email: security@zestic.com
- For general questions: Open a GitHub discussion

Thank you for helping keep @zestic/oauth-core secure!
