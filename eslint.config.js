import tseslint from 'typescript-eslint';
import tsParser from '@typescript-eslint/parser';
import eslintPluginAstro from 'eslint-plugin-astro';
import eslintComments from 'eslint-plugin-eslint-comments';

export default tseslint.config(
  // Global ignores
  {
    ignores: ['dist/**', '.astro/**', 'node_modules/**', 'scratch/**', 'scripts/**'],
  },
  // Recommended Astro configuration
  ...eslintPluginAstro.configs.recommended,
  // TypeScript configuration: set typescript parser for all TS files
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
    },
  },
  // Custom strict rules
  {
    files: ['**/*.ts', '**/*.astro'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'eslint-comments': eslintComments,
    },
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
    rules: {
      // 1. Disallow the use of explicit `any`
      '@typescript-eslint/no-explicit-any': 'error',

      // 2. Disallow specific restricted types (unknown, object)
      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            unknown: 'The "unknown" type is disallowed. Please use concrete interfaces, types, or generic parameters instead.',
            object: 'The "object" type is disallowed. Please define a specific type/interface or use Record<string, any> (or whatever indexable type) instead.',
          },
        },
      ],

      // 3. Disallow the use of eslint-disable directive comments
      'eslint-comments/no-use': [
        'error',
        {
          allow: []
        }
      ],
    },
  }
);
