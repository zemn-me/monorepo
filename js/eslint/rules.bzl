load("@npm//:eslint/package_json.bzl", "bin")


def eslint_test(name = None, data = [], srcs = [], args = [], tags = [], **kwargs):
    bin.eslint_test(
        name = name,
        data = srcs + data + [
            "//:.prettierrc.json",
            "//:.gitignore",
            "//:.editorconfig",
            "//:.eslintrc.json",
            "//:node_modules/eslint-plugin-prettier",
            "//:node_modules/@typescript-eslint/parser",
            "//:node_modules/@typescript-eslint/eslint-plugin",
            "//:node_modules/eslint-config-prettier",
            "//:node_modules/eslint-plugin-react",
            "//:node_modules/eslint-plugin-simple-import-sort",
        ],
        args = args + ["--ignore-path", "$(location //:.gitignore)"] +
               ["$(location " + x + ")" for x in data + srcs],
        tags = tags + ["+formatting"],
    )
