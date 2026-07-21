import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['{apps,packages,tests}/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      exclude: ['**/generated/**', '**/*.d.ts', '**/tests/**'],
    },
    sequence: { concurrent: false },
  },
});
