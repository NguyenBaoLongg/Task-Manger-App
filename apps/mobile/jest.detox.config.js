module.exports = {
  rootDir: __dirname,
  testEnvironment: 'detox/runners/jest/testEnvironment',
  testMatch: ['<rootDir>/tests/e2e/**/*.e2e.[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/'],
  testTimeout: 1_800_000,
  transformIgnorePatterns: [],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  verbose: true,
};
