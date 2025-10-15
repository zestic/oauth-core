/**
 * Tests for ConfigValidator class
 */

import { ConfigValidator } from '../../src/validation/ConfigValidator';
import type { OAuthConfig } from '../../src/types/OAuthTypes';

describe('ConfigValidator', () => {
  const validConfig: OAuthConfig = {
    clientId: 'test-client-id',
    endpoints: {
      authorization: 'https://auth.example.com/oauth/authorize',
      token: 'https://auth.example.com/oauth/token',
      revocation: 'https://auth.example.com/oauth/revoke',
    },
    redirectUri: 'https://app.example.com/callback',
    scopes: ['read', 'write'],
  };

  describe('validate', () => {
    it('should return valid result for correct configuration', () => {
      const result = ConfigValidator.validate(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should collect all validation errors and warnings', () => {
      const invalidConfig: OAuthConfig = {
        clientId: '',
        endpoints: {
          authorization: 'invalid-url',
          token: 'ftp://invalid.protocol.com/token',
          revocation: 'https://valid.com/revoke',
        },
        redirectUri: 'invalid-redirect#fragment',
        scopes: ['read write', 'read'], // whitespace and duplicate
      };

      const result = ConfigValidator.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateClientId', () => {
    it('should accept valid client ID', () => {
      const errors = ConfigValidator.validateClientId('valid-client-id');
      expect(errors).toHaveLength(0);
    });

    it('should reject empty client ID', () => {
      const errors = ConfigValidator.validateClientId('');
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('MISSING_CLIENT_ID');
    });

    it('should reject whitespace-only client ID', () => {
      const errors = ConfigValidator.validateClientId('   ');
      expect(errors).toHaveLength(2); // Has spaces AND is empty after trim
      expect(errors.some(e => e.code === 'EMPTY_CLIENT_ID')).toBe(true);
      expect(errors.some(e => e.code === 'CLIENT_ID_HAS_SPACES')).toBe(true);
    });

    it('should reject client ID with spaces', () => {
      const errors = ConfigValidator.validateClientId('client id');
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('CLIENT_ID_HAS_SPACES');
    });

    it('should reject non-string client ID', () => {
      const errors = ConfigValidator.validateClientId(null as any);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('MISSING_CLIENT_ID');
    });
  });

  describe('validateEndpoints', () => {
    it('should accept valid endpoints', () => {
      const endpoints = {
        authorization: 'https://auth.example.com/oauth/authorize',
        token: 'https://auth.example.com/oauth/token',
        revocation: 'https://auth.example.com/oauth/revoke',
      };

      const result = ConfigValidator.validateEndpoints(endpoints);
      expect(result.errors).toHaveLength(0);
    });

    it('should require authorization and token endpoints', () => {
      const endpoints = {
        authorization: '',
        token: '',
        revocation: 'https://valid.com/revoke',
      };

      const result = ConfigValidator.validateEndpoints(endpoints);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].code).toBe('MISSING_AUTHORIZATION_ENDPOINT');
      expect(result.errors[1].code).toBe('MISSING_TOKEN_ENDPOINT');
    });

    it('should validate URL formats', () => {
      const endpoints = {
        authorization: 'not-a-url',
        token: 'https://valid.com/token',
        revocation: 'https://valid.com/revoke',
      };

      const result = ConfigValidator.validateEndpoints(endpoints);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MALFORMED_URL');
    });

    it('should warn about non-HTTPS endpoints', () => {
      const endpoints = {
        authorization: 'http://auth.example.com/oauth/authorize',
        token: 'https://auth.example.com/oauth/token',
      };

      const result = ConfigValidator.validateEndpoints(endpoints);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('AUTHORIZATION_NOT_HTTPS');
    });

    it('should allow localhost HTTP URLs', () => {
      const endpoints = {
        authorization: 'http://localhost:3000/oauth/authorize',
        token: 'https://auth.example.com/oauth/token',
      };

      const result = ConfigValidator.validateEndpoints(endpoints);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('validateRedirectUri', () => {
    it('should accept valid HTTPS redirect URI', () => {
      const errors = ConfigValidator.validateRedirectUri('https://app.example.com/callback');
      expect(errors).toHaveLength(0);
    });

    it('should accept localhost HTTP redirect URI', () => {
      const errors = ConfigValidator.validateRedirectUri('http://localhost:3000/callback');
      expect(errors).toHaveLength(0);
    });

    it('should reject missing redirect URI', () => {
      const errors = ConfigValidator.validateRedirectUri(null as any);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('MISSING_REDIRECT_URI');
    });

    it('should reject empty redirect URI', () => {
      const errors = ConfigValidator.validateRedirectUri('');
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('MISSING_REDIRECT_URI');
    });

    it('should reject redirect URI with fragment', () => {
      const errors = ConfigValidator.validateRedirectUri('https://app.example.com/callback#fragment');
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('REDIRECT_URI_HAS_FRAGMENT');
    });

    it('should reject non-HTTPS redirect URI (except localhost)', () => {
      const errors = ConfigValidator.validateRedirectUri('http://example.com/callback');
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('REDIRECT_URI_NOT_HTTPS');
    });

    it('should reject malformed URLs', () => {
      const errors = ConfigValidator.validateRedirectUri('not-a-url');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.code === 'MALFORMED_URL' || e.code === 'REDIRECT_URI_NOT_HTTPS')).toBe(true);
    });
  });

  describe('validateScopes', () => {
    it('should accept valid scopes array', () => {
      const warnings = ConfigValidator.validateScopes(['read', 'write']);
      expect(warnings).toHaveLength(0);
    });

    it('should warn about empty scopes', () => {
      const warnings = ConfigValidator.validateScopes([]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].code).toBe('EMPTY_SCOPES');
    });

    it('should warn about scopes with whitespace', () => {
      const warnings = ConfigValidator.validateScopes(['read write', 'profile']);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].code).toBe('SCOPES_WITH_WHITESPACE');
    });

    it('should warn about duplicate scopes', () => {
      const warnings = ConfigValidator.validateScopes(['read', 'write', 'read']);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].code).toBe('DUPLICATE_SCOPES');
    });

    it('should warn about non-array scopes', () => {
      const warnings = ConfigValidator.validateScopes(null as any);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].code).toBe('SCOPES_NOT_ARRAY');
    });

    it('should handle multiple warnings', () => {
      const warnings = ConfigValidator.validateScopes(['read write', 'read write']);
      expect(warnings.length).toBeGreaterThan(1);
    });
  });

  describe('edge cases', () => {
    it('should handle complex invalid configurations', () => {
      const invalidConfig: OAuthConfig = {
        clientId: 'client with spaces',
        endpoints: {
          authorization: 'ftp://invalid.com/auth',
          token: '',
          revocation: 'https://valid.com/revoke',
        },
        redirectUri: 'http://example.com/callback#bad',
        scopes: ['scope with spaces', 'normal-scope', 'scope with spaces'],
      };

      const result = ConfigValidator.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3); // Multiple errors
      expect(result.warnings.length).toBeGreaterThan(1); // Multiple warnings
    });

    it('should validate localhost variations', () => {
      const localhostUrls = [
        'http://localhost:3000/callback',
        'http://127.0.0.1:8080/callback',
        'http://0.0.0.0:4000/callback',
      ];

      for (const url of localhostUrls) {
        const errors = ConfigValidator.validateRedirectUri(url);
        expect(errors).toHaveLength(0);
      }
    });
  });
});