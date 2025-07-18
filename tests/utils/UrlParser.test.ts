/**
 * Tests for UrlParser utility
 */

import { UrlParser } from '../../src/utils/UrlParser';

describe('UrlParser', () => {
  describe('parseParams', () => {
    it('should parse URLSearchParams directly', () => {
      const original = new URLSearchParams('code=test&state=abc');
      const parsed = UrlParser.parseParams(original);
      
      expect(parsed).toBe(original);
    });

    it('should parse full URL', () => {
      const url = 'https://app.example.com/callback?code=test&state=abc';
      const parsed = UrlParser.parseParams(url);
      
      expect(parsed.get('code')).toBe('test');
      expect(parsed.get('state')).toBe('abc');
    });

    it('should parse query string with leading ?', () => {
      const queryString = '?code=test&state=abc';
      const parsed = UrlParser.parseParams(queryString);
      
      expect(parsed.get('code')).toBe('test');
      expect(parsed.get('state')).toBe('abc');
    });

    it('should parse query string without leading ?', () => {
      const queryString = 'code=test&state=abc';
      const parsed = UrlParser.parseParams(queryString);
      
      expect(parsed.get('code')).toBe('test');
      expect(parsed.get('state')).toBe('abc');
    });
  });

  describe('extractParams', () => {
    it('should extract specified parameters', () => {
      const params = new URLSearchParams('code=test&state=abc&token=xyz');
      const extracted = UrlParser.extractParams(params, ['code', 'state', 'missing']);
      
      expect(extracted).toEqual({
        code: 'test',
        state: 'abc',
        missing: undefined,
      });
    });
  });

  describe('hasRequiredParams', () => {
    it('should return true when all required params are present', () => {
      const params = new URLSearchParams('code=test&state=abc');
      const hasRequired = UrlParser.hasRequiredParams(params, ['code', 'state']);
      
      expect(hasRequired).toBe(true);
    });

    it('should return false when required params are missing', () => {
      const params = new URLSearchParams('code=test');
      const hasRequired = UrlParser.hasRequiredParams(params, ['code', 'state']);
      
      expect(hasRequired).toBe(false);
    });
  });

  describe('hasAnyParams', () => {
    it('should return true when any param is present', () => {
      const params = new URLSearchParams('code=test');
      const hasAny = UrlParser.hasAnyParams(params, ['code', 'token']);
      
      expect(hasAny).toBe(true);
    });

    it('should return false when no params are present', () => {
      const params = new URLSearchParams('other=value');
      const hasAny = UrlParser.hasAnyParams(params, ['code', 'token']);
      
      expect(hasAny).toBe(false);
    });
  });

  describe('getFirstParam', () => {
    it('should return first available parameter', () => {
      const params = new URLSearchParams('token=test&magic_link_token=other');
      const first = UrlParser.getFirstParam(params, ['missing', 'token', 'magic_link_token']);
      
      expect(first).toBe('test');
    });

    it('should return null when no parameters are found', () => {
      const params = new URLSearchParams('other=value');
      const first = UrlParser.getFirstParam(params, ['code', 'token']);
      
      expect(first).toBeNull();
    });
  });

  describe('toObject', () => {
    it('should convert URLSearchParams to object', () => {
      const params = new URLSearchParams('code=test&state=abc');
      const obj = UrlParser.toObject(params);
      
      expect(obj).toEqual({
        code: 'test',
        state: 'abc',
      });
    });
  });

  describe('fromObject', () => {
    it('should create URLSearchParams from object', () => {
      const obj = {
        code: 'test',
        state: 'abc',
        number: 123,
        boolean: true,
        undefined: undefined,
        null: null,
      };
      
      const params = UrlParser.fromObject(obj);
      
      expect(params.get('code')).toBe('test');
      expect(params.get('state')).toBe('abc');
      expect(params.get('number')).toBe('123');
      expect(params.get('boolean')).toBe('true');
      expect(params.has('undefined')).toBe(false);
      expect(params.has('null')).toBe(false);
    });
  });

  describe('validateParam', () => {
    it('should validate parameter with custom validator', () => {
      const params = new URLSearchParams('code=test123');
      const isValid = UrlParser.validateParam(params, 'code', (value) => value.startsWith('test'));
      
      expect(isValid).toBe(true);
    });

    it('should return false for invalid parameter', () => {
      const params = new URLSearchParams('code=invalid');
      const isValid = UrlParser.validateParam(params, 'code', (value) => value.startsWith('test'));
      
      expect(isValid).toBe(false);
    });

    it('should return false for missing parameter', () => {
      const params = new URLSearchParams('other=value');
      const isValid = UrlParser.validateParam(params, 'code', (value) => value.startsWith('test'));
      
      expect(isValid).toBe(false);
    });
  });

  describe('extractOAuthError', () => {
    it('should extract OAuth error information', () => {
      const params = new URLSearchParams('error=access_denied&error_description=User%20denied%20access');
      const error = UrlParser.extractOAuthError(params);
      
      expect(error).toEqual({
        error: 'access_denied',
        errorDescription: 'User denied access',
      });
    });

    it('should handle missing error information', () => {
      const params = new URLSearchParams('code=test');
      const error = UrlParser.extractOAuthError(params);
      
      expect(error).toEqual({
        error: undefined,
        errorDescription: undefined,
      });
    });
  });

  describe('hasOAuthError', () => {
    it('should detect OAuth error', () => {
      const params = new URLSearchParams('error=access_denied');
      expect(UrlParser.hasOAuthError(params)).toBe(true);
    });

    it('should return false when no error', () => {
      const params = new URLSearchParams('code=test');
      expect(UrlParser.hasOAuthError(params)).toBe(false);
    });
  });

  describe('sanitizeForLogging', () => {
    it('should redact sensitive parameters', () => {
      const params = new URLSearchParams('code=secret&token=secret&state=safe&other=value');
      const sanitized = UrlParser.sanitizeForLogging(params);
      
      expect(sanitized).toEqual({
        code: '[REDACTED]',
        token: '[REDACTED]',
        state: 'safe',
        other: 'value',
      });
    });
  });

  describe('merge', () => {
    it('should merge multiple URLSearchParams', () => {
      const params1 = new URLSearchParams('a=1&b=2');
      const params2 = new URLSearchParams('c=3&d=4');
      const params3 = new URLSearchParams('b=5'); // Should overwrite b=2
      
      const merged = UrlParser.merge(params1, params2, params3);
      
      expect(merged.get('a')).toBe('1');
      expect(merged.get('b')).toBe('5'); // Overwritten
      expect(merged.get('c')).toBe('3');
      expect(merged.get('d')).toBe('4');
    });
  });
});
