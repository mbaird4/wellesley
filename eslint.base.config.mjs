import nx from '@nx/eslint-plugin';
import stylistic from '@stylistic/eslint-plugin';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import prettierConfig from 'eslint-config-prettier';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'type:models',
              onlyDependOnLibsWithTags: [],
            },
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: [],
            },
            {
              sourceTag: 'type:processors',
              onlyDependOnLibsWithTags: ['type:models'],
            },
            {
              sourceTag: 'type:data',
              onlyDependOnLibsWithTags: [
                'type:models',
                'type:processors',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: [
                'type:models',
                'type:processors',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:models',
                'type:processors',
                'type:data',
                'type:ui',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:models',
                'type:processors',
                'type:data',
                'type:ui',
                'type:util',
                'type:feature',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    plugins: {
      'simple-import-sort': simpleImportSort,
      '@stylistic': stylistic,
    },
    rules: {
      // Import sorting
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      // General best practices (all auto-fixable → error)
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      'object-shorthand': 'error',
      'prefer-template': 'error',
      curly: ['error', 'all'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Stylistic (auto-fixable → error)
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
      ],
      '@stylistic/lines-between-class-members': [
        'error',
        'always',
        { exceptAfterSingleLine: true },
      ],
    },
  },
  // TypeScript-specific rules
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Disabled: conflicts with Prettier (printWidth: 9999 for .ts keeps imports single-line)
      '@nx/workspace-decorator-newlines': 'off',
    },
  },
  // Disable no-console for scripts and CLI
  {
    files: ['scripts/**/*', '**/cli.ts', '**/generate-expectations.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  // Disable ESLint rules that conflict with Prettier (must be last)
  prettierConfig,
];
