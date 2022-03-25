def css_lint(name = None, srcs = [], **kwargs):
    native.sh_test(
        name = name,
        srcs = ["//css/lint:lint.sh"],
        data = [
            "//css/lint:stylelint-config.json",
            "@npm//stylelint/bin:stylelint",
            # I am not sure what exactly files it needs.......
            "@npm//:node_modules",
        ] + srcs,
        env = {
            "LOCAL_FILES": " ".join(["$(rootpaths " + src + ")" for src in srcs]),
        },
        deps = ["@bazel_tools//tools/bash/runfiles"],
        **kwargs
    )
