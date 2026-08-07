import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const typeCheckedRules = Object.assign(
  {},
  ...tseslint.configs.recommendedTypeChecked.map((config) => config.rules ?? {}),
);
const disableTypeCheckedRules = Object.fromEntries(
  Object.keys(typeCheckedRules).map((rule) => [rule, 'off']),
);

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/*.d.ts',
      'apps/worker/src/**/*.js',
      'dist-tests/**',
      '**/coverage/**',
      '**/generated/**',
      'third_party/**',
      '.cache/**',
      '.agents/**',
      '.specify/**',
      '.tools/**',
      'vitest.config.ts',
      '**/.detoxrc.js',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettier,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: {
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 100,
          allowDefaultProject: [
            'apps/worker/tests/unit/*.test.ts',
            'apps/worker/tests/integration/*.test.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        __ENV: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
      },
    },
    rules: {
      ...disableTypeCheckedRules,
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/await-thenable': 'off',
    },
  },
  {
    files: ['apps/mobile/**/*.js', 'apps/mobile/**/*.mjs'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
);
