load("@npm//eslint:index.bzl", _eslint_test = "eslint_test")

def eslint_test(name = None, data = [], srcs = [], args = [], tags = [], **kwargs):
    _eslint_test(
        name = name,
        data = srcs + data + [
            "//:.prettierrc.json",
            "//:.gitignore",
            "//:.editorconfig",
            "//:.eslintrc.json",
            "@npm//eslint-plugin-prettier",
            "@npm//@typescript-eslint/parser",
            "@npm//@typescript-eslint/eslint-plugin",
            "@npm//eslint-config-prettier",
            "@npm//eslint-plugin-react",
            "@npm//eslint-plugin-simple-import-sort",
        ],
        args = args + ["--ignore-path", "$(location //:.gitignore)"] +
               ["$(location " + x + ")" for x in data + srcs],
        tags = tags + ["+formatting"],
    )
