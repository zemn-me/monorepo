load("@npm//eslint:index.bzl", "eslint_test")

eslintrc = "//:eslint_config"
ambient_data = [
    eslintrc,
    "//:.gitignore",
]

def ts_lint(name, srcs = [], tags = [], data = [], **kwargs):
    targets = srcs + data
    eslint_test(
        name = name,
        data = targets + ambient_data,
        tags = tags + ["+formatting"],
        args = ["$(location %s)" % x for x in targets] +
               [
                   "--ignore-path",
                   "$(location //:.gitignore)",
               ],
        **kwargs
    )
