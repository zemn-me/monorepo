load("@npm//stylelint:index.bzl", "stylelint_test")

def css_lint(name = None, srcs = [], **kwargs):
    stylelint_test(
        name = name,
        data = [ "//css/lint:stylelint_config" ] + srcs,
        templated_args = [
            "--config", "css/lint/stylelint-config.json"
        ] + [
            "$(rootpaths " + x + ")" for x in srcs
        ],
        **kwargs
    )