import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default defineConfig(
    { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                // The config files sit outside src and tests; let the service type
                // them without adding them to the published build.
                projectService: { allowDefaultProject: ['eslint.config.js'] },
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            '@typescript-eslint/consistent-type-imports': 'error',
            '@typescript-eslint/explicit-module-boundary-types': 'error',
            eqeqeq: ['error', 'always'],

            // Numbers in a template literal are unambiguous and safe.
            '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],

            // `noUncheckedIndexedAccess` makes every typed-array read `number |
            // undefined`, which the hot loop has to narrow somehow. We ban `!`
            // because it is a single character that is easy to miss in review, and
            // therefore also switch off the rule that asks for it: an explicit
            // `as number` states the same assumption where a reader will see it.
            '@typescript-eslint/no-non-null-assertion': 'error',
            '@typescript-eslint/non-nullable-type-assertion-style': 'off',
        },
    },
    {
        files: ['src/react.ts'],
        plugins: { 'react-hooks': reactHooks },
        rules: reactHooks.configs.recommended.rules,
    },
    {
        files: ['tests/**/*.ts'],
        rules: { '@typescript-eslint/no-unsafe-type-assertion': 'off' },
    },
);
