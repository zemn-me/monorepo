def yaml_lint_test(name, srcs = None, **kwargs):
    if srcs == None:
        srcs = native.glob(["**/*.yml", "**/*.yaml"])
    native.sh_test(
        name = name,
        env = {
            "YAMLLINT": "$(rootpath //py/yamllint)",
        },
        srcs = ["//yml:test_runner.sh"],
        data = ["//py/yamllint", "//yml:yamllint_data_deps"] + srcs,
        args = ["$(rootpath %s)" % x for x in srcs],
        **kwargs
    )
