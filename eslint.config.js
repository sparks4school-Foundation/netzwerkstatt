import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'playwright-report', 'test-results'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
  },
  {
    files: ['src/**/*.tsx'],
    extends: [jsxA11y.flatConfigs.recommended],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // Architekturgrenzen (siehe AGENTS.md 5.1): sim/ und model/ kennen die UI nicht.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.app.json' } },
      'boundaries/elements': [
        { type: 'model', pattern: 'src/model/**' },
        { type: 'sim', pattern: 'src/sim/**' },
        { type: 'content', pattern: 'src/content/**' },
        { type: 'stufen', pattern: 'src/stufen/**' },
        { type: 'ui', pattern: 'src/ui/**' },
        { type: 'app', pattern: 'src/*.{ts,tsx}', partialMatch: false },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'model' } },
              allow: { to: { element: { types: { anyOf: ['model'] } } } },
            },
            {
              from: { element: { type: 'sim' } },
              allow: { to: { element: { types: { anyOf: ['sim', 'model'] } } } },
            },
            {
              from: { element: { type: 'content' } },
              allow: { to: { element: { types: { anyOf: ['content', 'model', 'sim'] } } } },
            },
            {
              from: { element: { type: 'stufen' } },
              allow: { to: { element: { types: { anyOf: ['stufen', 'model', 'content'] } } } },
            },
            {
              from: { element: { type: 'ui' } },
              allow: { to: { element: { types: { anyOf: ['ui', 'model', 'sim', 'content', 'stufen'] } } } },
            },
            {
              from: { element: { type: 'app' } },
              allow: {
                to: { element: { types: { anyOf: ['app', 'ui', 'model', 'sim', 'content', 'stufen'] } } },
              },
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/model/**', 'src/sim/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Die Engine darf nicht auf den Browser zugreifen.' },
        { name: 'document', message: 'Die Engine darf nicht auf den Browser zugreifen.' },
        { name: 'setTimeout', message: 'Zeit läuft nur über die simulierte Uhr.' },
        { name: 'setInterval', message: 'Zeit läuft nur über die simulierte Uhr.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Zufall nur über den Seed-PRNG (sim/zufall.ts).' },
        { object: 'Date', property: 'now', message: 'Zeit läuft nur über die simulierte Uhr.' },
      ],
    },
  },
  {
    files: ['*.config.ts', 'e2e/**'],
    languageOptions: { globals: globals.node },
  },
);
