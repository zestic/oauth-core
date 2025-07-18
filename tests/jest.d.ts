/// <reference types="jest" />

declare global {
  const jest: typeof import('jest');
  const describe: typeof import('@jest/globals').describe;
  const it: typeof import('@jest/globals').it;
  const test: typeof import('@jest/globals').test;
  const expect: typeof import('@jest/globals').expect;
  const beforeAll: typeof import('@jest/globals').beforeAll;
  const beforeEach: typeof import('@jest/globals').beforeEach;
  const afterAll: typeof import('@jest/globals').afterAll;
  const afterEach: typeof import('@jest/globals').afterEach;
}

export {};
