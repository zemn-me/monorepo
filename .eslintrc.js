
module.exports = {
	"$schema": "https://json.schemastore.org/eslintrc",
	"root": true,
	"parser": "@typescript-eslint/parser",
	"plugins": ["prettier", "@typescript-eslint", "simple-import-sort"],
	"extends": [
		"eslint:recommended",
		"plugin:prettier/recommended",
		"plugin:@typescript-eslint/eslint-recommended",
		"plugin:@typescript-eslint/recommended",
		"plugin:react/recommended"
	],
	"rules": {
		"react/prop-types": 0,
		"react/display-name": 0,
		"react/prefer-read-only-props": [ "error" ],
		"react/react-in-jsx-scope": 0,
		"react/self-closing-comp": [ "error" ],
		"react/jsx-sort-props": [ "error" ],
		"react/no-unescaped-entities": 0,
		"@typescript-eslint/no-empty-interface": [
			"error",
			{ "allowSingleExtends": true }
		],
		"prettier/prettier": "error",
		"arrow-parens": ["error", "as-needed"],
		"arrow-spacing": ["error", { "before": true, "after": true }],
		"prefer-const": ["error", { "destructuring": "all" }],
		"no-else-return": ["error", { "allowElseIf": false }],
		"no-extra-bind": "error",
		"no-multi-spaces": ["error"],
		"array-bracket-newline": ["error", "consistent"],
		"no-unused-expressions": [ "error" ],
		"no-constant-binary-expression": [ "error" ],
		"no-sequences": ["error"],
		"@typescript-eslint/no-floating-promises": "error",
		"@typescript-eslint/no-misused-promises": "error",
		"array-element-newline": ["error", "consistent"],
		"block-spacing": ["error", "always"],
		"comma-spacing": ["error"],
		"computed-property-spacing": ["error"],
		"key-spacing": ["error"],
		"simple-import-sort/imports": [ "error" ],
		"simple-import-sort/exports": [ "error" ],
		"keyword-spacing": "error",
		"object-curly-newline": ["error"],
		"@typescript-eslint/no-unused-vars": "error",
		"arrow-body-style": ["error", "as-needed"]
	},
	"parserOptions": {
		"tsconfigRootDir": __dirname,
		"sourceType": "module",
		"ecmaVersion": 2020,
		"project": ["tsconfig.json" ]
	},
	"ignorePatterns": [ "tsconfig.json" ],
	"settings": {
		"react": {
			"version": "detect"
		}
	}
}
