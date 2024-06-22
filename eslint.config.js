import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import js from "@eslint/js";
import next from '@next/eslint-plugin-next';
import * as mdx from 'eslint-plugin-mdx';
import onlyError from 'eslint-plugin-only-error';
import reactPlugin from 'eslint-plugin-react';
import reactRecommended from 'eslint-plugin-react/configs/recommended.js';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.FlatConfig} */
export const reactConfig = {
	name: 'react etc',
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2020,
    },
	rules: {
		...fixupConfigRules(reactRecommended),
		...reactHooksPlugin.configs.recommended.rules,
		...next.configs.recommended.rules,
	},
	plugins: {
			'react-hooks': reactHooksPlugin,
			'@next/next': next,
		'react': fixupPluginRules(reactPlugin),
		'simple-import-sort': simpleImportSort,
		'only-error': onlyError
	},
    rules: {
      'react/forbid-elements': [
        'error',
        {
			forbid: [
				{ element: 'a', message: '<a> is dangerous. Please use the Link component instead.' },
				{ element: 'video', message: 'native <video> does not respect reduced motion. Use Video in ts/react/video instead.' }
			],
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

}

/** @type {import('eslint').Linter.FlatConfig[]} */
export default tseslint.config(
	{
		name: 'ts files & js files',
		files: ['**/*.{ts,js}?(x)'],
		languageOptions: {
		parserOptions: {
			sourceType: 'module',
			ecmaVersion: 2020,
			project: ['tsconfig.json'],
		},
		},
		extends: [
			js.configs.recommended,
			...tseslint.configs.recommended,
			reactConfig
		],
		plugins: {
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
    },
	},
  {
	name: 'markdown',
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
)
