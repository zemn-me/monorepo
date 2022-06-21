load("@npm//stylelint:index.bzl", "stylelint_test")

def css_lint(name = None, srcs = [], **kwargs):
    stylelint_test(
        name = name,
        data = [ "//css/lint:stylelint_config" ] + srcs,
        templated_args = [
            "--config", "$(rlocation //css/lint:stylelint-config.json)"
        ] + [
            # todo: a rule to collect these?
            "$(rlocation //" + native.package_name() + ":" + x + ")" for x in srcs
        ]
    )
