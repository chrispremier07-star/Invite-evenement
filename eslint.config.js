import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      'node_modules/**',
      'prototype/**',
      'apps/api/drizzle/**',
      'playwright-report/**',
      'test-results/**',
      'backups/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-console': ['error', { allow: ['error', 'warn'] }],
    },
  },
  {
    files: ['apps/form/**/*.{ts,tsx}', 'apps/studio/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: { ...reactHooks.configs.recommended.rules, 'react-hooks/set-state-in-effect': 'off' },
  },
  { files: ['apps/studio/public/sw.js'], languageOptions: { globals: globals.serviceworker } },
  {
    files: ['apps/api/**/*.ts', 'scripts/**/*.mjs', 'e2e/**/*.{ts,mjs}', '*.config.{ts,js}'],
    languageOptions: { globals: globals.node },
  },
);
