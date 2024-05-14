import js from "@eslint/js";
import reactRecommended from 'eslint-plugin-react/configs/recommended.js';
import tseslint from 'typescript-eslint';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import next from '@next/eslint-plugin-next';
import * as mdx from 'eslint-plugin-mdx';
import { fixupPluginRules, fixupConfigRules } from "@eslint/compat";

// reference this or something idk https://github.com/SBoudrias/Inquirer.js/blob/7f1f592045da13862bbc14a77d68a0c27d2f7b7d/eslint.config.js#L44

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
	name: 'ignore tsconfig',
    ignores: ['tsconfig.json'],
  },
  {
	name: 'markdown config',
    files: ['**/*.md?(x)'],
    plugins: {
      mdx: 'eslint-plugin-mdx',
    },
    languageOptions: {
      extraFileExtensions: ['.md', '.mdx'],
    },
    settings: {
      'mdx/code-blocks': true,
      'mdx/language-mapper': {},
    },
    ...mdx.flat,
  },
    js.configs.recommended,
    ...fixupConfigRules(reactRecommended),

			...tseslint.configs.recommended,
  {
	name: 'ts & js files',
	  extends: [
	  ],
    files: ['**/*.{ts,js}?(x)'],
    languageOptions: {
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2020,
        project: ['tsconfig.json'],
      },
    },
    plugins: {
		'react-hooks': reactHooksPlugin,
		'@next/next': next,
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-empty-interface': ['error', { allowSingleExtends: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'error',
	  ...reactHooksPlugin.configs.recommended.rules,
	  ...next.configs.recommended.rules,
    },
  },
  {
	name: 'react etc',
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2020,
    },
    rules: {
      'react/forbid-elements': [
        'error',
        {
          forbid: [{ element: 'a', message: '<a> is dangerous. Please use the Link component instead.' }],
        },
      ],
      'no-restricted-imports': [
        'error',
        { name: 'next/link', message: '<NextLink> is dangerous. Please use the <Link> component instead.' },
      ],
      'react/prop-types': 'off',
      'react/display-name': 'off',
      'react/prefer-read-only-props': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/self-closing-comp': 'error',
      'react/jsx-sort-props': 'error',
      'react/no-unescaped-entities': 'off',
      'prettier/prettier': 'error',
      'arrow-parens': ['error', 'as-needed'],
      'arrow-spacing': ['error', { before: true, after: true }],
      'prefer-const': ['error', { destructuring: 'all' }],
      'no-else-return': ['error', { allowElseIf: false }],
      'no-extra-bind': 'error',
      'no-multi-spaces': 'error',
      'array-bracket-newline': ['error', 'consistent'],
      'no-unused-expressions': 'error',
      'no-constant-binary-expression': 'error',
      'no-sequences': 'error',
      'array-element-newline': ['error', 'consistent'],
      'block-spacing': ['error', 'always'],
      'comma-spacing': 'error',
      'computed-property-spacing': 'error',
      'key-spacing': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'keyword-spacing': 'error',
      'object-curly-newline': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      'no-console': 'error',
    },
    settings: {
      react: {
        version: 'detect',
      },
      next: {
        rootDir: ['project/zemn.me/'],
      },
    },
  },
];
