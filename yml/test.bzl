load("@rules_shell//shell:sh_test.bzl", "sh_test")

def yaml_lint_test(name, srcs = None, **kwargs):
    if srcs == None:
        srcs = native.glob(["**/*.yml", "**/*.yaml"], allow_empty = True)
    sh_test(
        name = name,
        env = {
            # i dont know why this is multiple files
            "YAMLLINT": "$(rlocationpaths //py/yamllint)",
        },
        srcs = ["//yml:test_runner.sh"],
        data = ["//py/yamllint", "//yml:yamllint_data_deps"] + srcs,
        args = ["$(rootpath %s)" % x for x in srcs],
        deps = [
            "@rules_shell//shell/runfiles",
        ],
        size = "small",
        **kwargs
    )
