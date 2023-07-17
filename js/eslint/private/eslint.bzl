load("@npm//:eslint/package_json.bzl", "bin")

"""
Injects a bunch of basic dependencies to make eslint work.
"""

BASE_DATA_DEPS = [
    "//:prettierrc",
    "//:gitignore",
    "//:editorconfig",
    "//:eslintrc",
    "//:node_modules/eslint-plugin-prettier",
    "//:node_modules/@typescript-eslint/parser",
    "//:node_modules/@typescript-eslint/eslint-plugin",
    "//:node_modules/eslint-config-prettier",
    "//:node_modules/eslint-plugin-react",
    "//:node_modules/eslint-plugin-simple-import-sort",
    "//:node_modules/eslint-plugin-mdx",
    "//:node_modules/eslint-mdx",

"//:node_modules/remark-preset-lint-recommended",
"//:node_modules/remark-retext",
"//:node_modules/unified",
"//:node_modules/retext-english",
"//:node_modules/retext-syntax-mentions",
"//:node_modules/retext-syntax-urls",
"//:node_modules/retext-spell",
"//:node_modules/dictionary-en",
"//:node_modules/retext-contractions",
"//:node_modules/retext-diacritics",
"//:node_modules/retext-equality",
"//:node_modules/retext-indefinite-article",
"//:node_modules/retext-intensify",
"//:node_modules/retext-passive",
"//:node_modules/retext-profanities",
"//:node_modules/retext-readability",
"//:node_modules/retext-redundant-acronyms",
"//:node_modules/retext-repeated-words",
"//:node_modules/retext-sentence-spacing",
"//:node_modules/retext-simplify",
"//:package_json",

    "//:remarkrc"
]

def eslint_test(name = None, data = [], args = [], **kwargs):
    bin.eslint_test(
        name = name,
        data = data + BASE_DATA_DEPS,
        args = args,
        **kwargs
    )

def eslint_binary(name = None, data = [], args = [], **kwargs):
    bin.eslint_binary(
        name = name,
        data = data + BASE_DATA_DEPS,
        args = args,
        **kwargs
    )
