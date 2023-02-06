load("@npm//:eslint/package_json.bzl", "bin")


def eslint_test(name = None, data = [], srcs = [], args = [], tags = [], **kwargs):
    bin.eslint_test(
        name = name,
        data = srcs + data + [
            "//:.prettierrc.json",
            "//:.gitignore",
            "//:.editorconfig",
            "//:.eslintrc.json",
            "@npm//:eslint-plugin-prettier",
            "@npm//:@typescript-eslint/parser",
            "@npm//:@typescript-eslint/eslint-plugin",
            "@npm//:eslint-config-prettier",
            "@npm//:eslint-plugin-react",
            "@npm//:eslint-plugin-simple-import-sort",
        ],
        args = args + ["--ignore-path", "$(location //:.gitignore)"] +
               ["$(location " + x + ")" for x in data + srcs],
        tags = tags + ["+formatting"],
    )
