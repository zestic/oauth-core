/**
 * GraphQL Schema Definitions for OAuth Core
 */

export const typeDefs = `
  scalar JSON

  input RegistrationInput {
    email: String!
    additionalData: JSON!
    codeChallenge: String!
    codeChallengeMethod: String!
    redirectUri: String!
    state: String!
  }

  input SendMagicLinkInput {
    email: String!
    codeChallenge: String!
    codeChallengeMethod: String!
    redirectUri: String!
    state: String!
  }

  type RegistrationResponse {
    success: Boolean!
    message: String!
    code: String!
  }

  type MagicLinkResponse {
    success: Boolean!
    message: String!
    code: String!
  }

  type Mutation {
    register(input: RegistrationInput!): RegistrationResponse!
    sendMagicLink(input: SendMagicLinkInput!): MagicLinkResponse!
  }

  type Query {
    # Placeholder query - GraphQL requires at least one query
    _empty: String
  }
`;

/**
 * GraphQL Schema as a string for use with various GraphQL servers
 */
export const schemaString = typeDefs;
