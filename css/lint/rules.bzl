load("@npm//:stylelint/package_json.bzl", "bin")

def css_lint(name = None, srcs = [], **kwargs):
    bin.stylelint_test(
        name = name,
        data = ["//css/lint:stylelint_config"] + srcs,
        args = [
            "--config",
            "css/lint/stylelint-config.json",
        ] + [
            "$(rootpaths " + x + ")"
            for x in srcs
        ],
        **kwargs
    )
