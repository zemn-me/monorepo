load("@npm//stylelint:index.bzl", "stylelint_test")

def css_lint(name = None, srcs = [], **kwargs):
    stylelint_test(
        name = name,
        data = [ "//css/lint:stylelint_config" ] + srcs,
        templated_args = [
            "--config", "$(rlocation //css/lint:stylelint-config.json)"
        ] + [
            "$(rlocation " + x + ")" for x in srcs
        ]
    )
