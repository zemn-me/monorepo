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
