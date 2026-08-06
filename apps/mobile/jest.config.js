module.exports = {
  rootDir: __dirname,
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  // pnpm stores Expo/React Native sources under a nested .pnpm path. Transforming
  // dependencies keeps Jest deterministic across Windows and POSIX workspaces.
  transformIgnorePatterns: [],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@react-native/js-polyfills/error-guard$': '<rootDir>/tests/mocks/react-native-error-guard.js',
  },
};
