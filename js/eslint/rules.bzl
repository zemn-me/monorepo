load("//bzl/run_in_workspace:rules.bzl", "run_in_workspace")
load("//js/eslint/private:eslint.bzl", "BASE_DATA_DEPS", _eslint_binary = "eslint_binary", _eslint_test = "eslint_test")

def eslint_test(name = None, data = [], srcs = [], args = [], tags = [], **kwargs):
    args = args + ["--ignore-path", "$(location //:gitignore)"]

    data = data + ["//:tsconfig"]

    args = args + ["$(rootpath " + x + ")" for x in data + srcs]
    _eslint_test(
        name = name,
        data = srcs + data,
        args = args,
        tags = tags + ["fixable", "+formatting"],
    )

    _eslint_binary(
        name = name + ".fix_",
        data = srcs + data,
        # For whatever reason, you can't run the eslint binary with args specified here from
        # another binary
        # args = args + ["--fix"],
    )

    run_in_workspace(
        name = name + ".fix",
        src = name + ".fix_",
        args = args + ["--fix"],
        deps = srcs + data + BASE_DATA_DEPS,
    )
