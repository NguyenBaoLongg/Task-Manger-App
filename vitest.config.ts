import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    include: [
      'apps/*/src/**/*.test.ts',
      'apps/*/tests/**/*.test.ts',
      'packages/*/src/**/*.test.ts',
      'packages/*/tests/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    // Mobile is intentionally owned by Jest/jest-expo; Vitest must not collect its tests.
    exclude: ['**/node_modules/**', 'apps/mobile/tests/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      exclude: ['**/generated/**', '**/*.d.ts', '**/tests/**'],
    },
    sequence: { concurrent: false },
  },
});
