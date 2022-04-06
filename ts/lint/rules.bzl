load("@npm//eslint:index.bzl", eslint_test = "eslint_test")

def ts_lint(name, srcs = [], tags = [], data = [], **kwargs):
    targets = srcs + data
    eslint_test(
        name = name,
        data = targets,
        tags = tags + ["+formatting"],
        args = ["$(location %s)" % x for x in targets],
        **kwargs
    )

