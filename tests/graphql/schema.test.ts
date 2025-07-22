import { typeDefs, schemaString } from '../../src/graphql/schema';

describe('GraphQL Schema', () => {
  describe('typeDefs', () => {
    it('should contain scalar JSON definition', () => {
      expect(typeDefs).toContain('scalar JSON');
    });

    it('should contain RegistrationInput definition', () => {
      expect(typeDefs).toContain('input RegistrationInput');
      expect(typeDefs).toContain('email: String!');
      expect(typeDefs).toContain('additionalData: JSON!');
      expect(typeDefs).toContain('codeChallenge: String!');
      expect(typeDefs).toContain('codeChallengeMethod: String!');
      expect(typeDefs).toContain('redirectUri: String!');
      expect(typeDefs).toContain('state: String!');
    });

    it('should contain SendMagicLinkInput definition', () => {
      expect(typeDefs).toContain('input SendMagicLinkInput');
      expect(typeDefs).toContain('email: String!');
      expect(typeDefs).toContain('codeChallenge: String!');
      expect(typeDefs).toContain('codeChallengeMethod: String!');
      expect(typeDefs).toContain('redirectUri: String!');
      expect(typeDefs).toContain('state: String!');
    });

    it('should contain RegistrationResponse definition', () => {
      expect(typeDefs).toContain('type RegistrationResponse');
      expect(typeDefs).toContain('success: Boolean!');
      expect(typeDefs).toContain('message: String!');
      expect(typeDefs).toContain('code: String!');
    });

    it('should contain MagicLinkResponse definition', () => {
      expect(typeDefs).toContain('type MagicLinkResponse');
      expect(typeDefs).toContain('success: Boolean!');
      expect(typeDefs).toContain('message: String!');
      expect(typeDefs).toContain('code: String!');
    });

    it('should contain Mutation definition', () => {
      expect(typeDefs).toContain('type Mutation');
      expect(typeDefs).toContain('register(input: RegistrationInput!): RegistrationResponse!');
      expect(typeDefs).toContain('sendMagicLink(input: SendMagicLinkInput!): MagicLinkResponse!');
    });

    it('should contain Query definition with placeholder', () => {
      expect(typeDefs).toContain('type Query');
      expect(typeDefs).toContain('_empty: String');
    });

    it('should be valid GraphQL schema syntax', () => {
      // Basic syntax validation - should not contain obvious syntax errors
      expect(typeDefs).not.toContain('type type');
      expect(typeDefs).not.toContain('input input');
      expect(typeDefs).not.toContain('scalar scalar');
      
      // Should have proper braces
      const openBraces = (typeDefs.match(/{/g) || []).length;
      const closeBraces = (typeDefs.match(/}/g) || []).length;
      expect(openBraces).toBe(closeBraces);
    });
  });

  describe('schemaString', () => {
    it('should be identical to typeDefs', () => {
      expect(schemaString).toBe(typeDefs);
    });

    it('should be a string', () => {
      expect(typeof schemaString).toBe('string');
    });

    it('should not be empty', () => {
      expect(schemaString.length).toBeGreaterThan(0);
    });
  });

  describe('schema completeness', () => {
    it('should define all required input fields as non-nullable', () => {
      // RegistrationInput required fields
      expect(typeDefs).toContain('email: String!');
      expect(typeDefs).toContain('additionalData: JSON!');
      expect(typeDefs).toContain('codeChallenge: String!');
      expect(typeDefs).toContain('codeChallengeMethod: String!');
      expect(typeDefs).toContain('redirectUri: String!');
      expect(typeDefs).toContain('state: String!');
    });

    it('should define all response fields as non-nullable', () => {
      // Response fields should be non-nullable for consistent API
      const responseFields = ['success: Boolean!', 'message: String!', 'code: String!'];
      
      responseFields.forEach(field => {
        expect(typeDefs).toContain(field);
      });
    });

    it('should have consistent field naming', () => {
      // Check that field names follow consistent patterns
      expect(typeDefs).toContain('codeChallenge');
      expect(typeDefs).toContain('codeChallengeMethod');
      expect(typeDefs).toContain('redirectUri');
      
      // Should not have inconsistent naming
      expect(typeDefs).not.toContain('code_challenge');
      expect(typeDefs).not.toContain('redirect_uri');
    });

    it('should include all necessary mutations', () => {
      const mutations = ['register', 'sendMagicLink'];
      
      mutations.forEach(mutation => {
        expect(typeDefs).toContain(mutation);
      });
    });

    it('should use proper GraphQL conventions', () => {
      // Input types should end with 'Input'
      expect(typeDefs).toContain('RegistrationInput');
      expect(typeDefs).toContain('SendMagicLinkInput');
      
      // Response types should end with 'Response'
      expect(typeDefs).toContain('RegistrationResponse');
      expect(typeDefs).toContain('MagicLinkResponse');
      
      // Mutations should use input objects
      expect(typeDefs).toContain('register(input: RegistrationInput!)');
      expect(typeDefs).toContain('sendMagicLink(input: SendMagicLinkInput!)');
    });
  });

  describe('schema structure', () => {
    it('should have proper type definitions order', () => {
      const schemaLines = typeDefs.split('\n').filter(line => line.trim());
      
      // Find indices of major sections
      const scalarIndex = schemaLines.findIndex(line => line.includes('scalar JSON'));
      const inputIndex = schemaLines.findIndex(line => line.includes('input RegistrationInput'));
      const typeIndex = schemaLines.findIndex(line => line.includes('type RegistrationResponse'));
      const mutationIndex = schemaLines.findIndex(line => line.includes('type Mutation'));
      // Verify logical ordering (scalars, inputs, types, operations)
      expect(scalarIndex).toBeGreaterThanOrEqual(0);
      expect(inputIndex).toBeGreaterThan(scalarIndex);
      expect(typeIndex).toBeGreaterThan(inputIndex);
      expect(mutationIndex).toBeGreaterThan(typeIndex);
    });

    it('should have consistent indentation', () => {
      const lines = typeDefs.split('\n');
      const indentedLines = lines.filter(line => line.startsWith('  ') && line.trim());
      
      // Should have some indented lines (field definitions)
      expect(indentedLines.length).toBeGreaterThan(0);
      
      // Check that indented lines are properly formatted
      indentedLines.forEach(line => {
        // Allow for scalar definitions, field definitions, type definitions, nested fields, closing braces, and comments
        expect(line).toMatch(/^  (\w+.*[!:].*|scalar \w+|input \w+.*\{|type \w+.*\{|\})$|^    (\w+.*[!:].*|#.*)$/);
      });
    });
  });
});
