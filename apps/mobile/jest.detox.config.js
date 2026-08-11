module.exports = {
  rootDir: __dirname,
  testEnvironment: 'detox/runners/jest/testEnvironment',
  testMatch: ['<rootDir>/tests/e2e/**/*.e2e.[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/'],
  // Forwards the local API port to the allocated device before any E2E test runs; see the file for
  // why a missing forward otherwise surfaces as a misleading matcher timeout.
  setupFilesAfterEnv: ['<rootDir>/tests/e2e/setup.ts'],
  testTimeout: 1_800_000,
  transformIgnorePatterns: [],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  verbose: true,
};
