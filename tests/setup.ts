/**
 * Test setup and global configuration
 */

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Store original methods for restoration
(globalThis as any).originalConsole = {
  log: originalConsoleLog,
  warn: originalConsoleWarn,
  error: originalConsoleError,
};

// Mock console methods during tests
console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

// Global test utilities
(globalThis as any).testUtils = {
  restoreConsole: () => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  },

  mockConsole: () => {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  },
};

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
