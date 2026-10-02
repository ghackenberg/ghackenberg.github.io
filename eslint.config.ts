import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import tsParser from '@typescript-eslint/parser';
import eslintPluginAstro from 'eslint-plugin-astro';
import eslintComments from 'eslint-plugin-eslint-comments';

export default defineConfig([
  {
    ignores: [
      'dist/**',
      '.astro/**',
      'node_modules/**',
      'scratch/**',
    ],
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
  },
  // 4. Path Alias Enforcement: disallow relative parent traversals into alias domains
  {
    files: ['**/*.ts', '**/*.astro'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(\\.\\.\\/)+(components|layouts|assets|styles|content|plugins|commons|scripts|tools)(\\/.*)?$',
              message:
                'Use path aliases (@components, @layouts, @assets, @styles, @content, @plugins, @commons, @tools) instead of relative parent imports (../). Co-located sibling imports (./) are permitted.',
            },
          ],
        },
      ],
    },
  },
  // 5. Architectural Boundaries: restrict cross-domain imports
  {
    // The web application and build plugins must not import from CLI scripts or MCP tools
    files: ['src/**/*.ts', 'src/**/*.astro', 'astro.config.ts'],
    ignores: ['src/scripts/**', 'src/tools/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*scripts*', '*tools*'],
              message: 'Web application code must not import from scripts/ or tools/. Scripts and tools are standalone CLI entrypoints.',
            },
          ],
        },
      ],
    },
  },
  {
    // Client-side commons must never import server-side commons or server-only Astro modules
    files: ['src/commons/client/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*server*', 'astro:content', 'node:*', 'fs', 'path', 'crypto'],
              message: 'src/commons/client must not import server modules or Node built-ins.',
            },
          ],
        },
      ],
    },
  },
  {
    // Universal/shared commons must remain pure and not depend on client or server specific modules
    files: ['src/commons/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*client*', '*server*'],
              message: 'src/commons/shared must remain isomorphic and not import from client/ or server/.',
            },
          ],
        },
      ],
    },
  },
  {
    // Standalone tools (MCP) must not import web pages, components, or CLI scripts
    files: ['src/tools/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*pages*', '*components*', '*layouts*', '*scripts*'],
              message: 'src/tools/ must not import from pages, components, layouts, or scripts. Import shared utilities from @commons instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // CLI scripts must not import web pages or layouts
    files: ['src/scripts/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*pages*', '*layouts*', '*tools*'],
              message: 'src/scripts/ must not import from pages, layouts, or tools.',
            },
          ],
        },
      ],
    },
  }
]);
