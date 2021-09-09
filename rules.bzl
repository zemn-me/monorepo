load("//tools/jest:jest.bzl",  _jest_test = "jest_test")
load("@npm//@bazel/typescript:index.bzl", _ts_project = "ts_project")
load("@npm//prettier:index.bzl", _prettier_test = "prettier_test", _prettier = "prettier")
load("@npm//@bazel/typescript:index.bzl", _ts_config = "ts_config")
load("@build_bazel_rules_nodejs//:index.bzl", _nodejs_binary = "nodejs_binary")

def nodejs_binary(**kwargs):
    _nodejs_binary(**kwargs)

def ts_config(**kwargs):
    _ts_config(**kwargs)

def jest_test(**kwargs):
    _jest_test(**kwargs)

def ts_lint(name, srcs = [], tags = [], data = [], **kwargs):
    targets = srcs + data
    prettier_test(
            name = name,
            data = targets,
            tags = tags + ["+formatting"],
            args = ["$(location %s)" % x for x in targets],
            **kwargs
    )



def ts_project(name, tags = [], deps = [], srcs = [], tsconfig = "//:tsconfig", **kwargs):
    _ts_project(
        name = name,
        tsc = "@npm//ttypescript/bin:ttsc",
	srcs = srcs,
        deps = deps + ["@npm//typescript-transform-paths"],
        tags = tags,
        tsconfig = tsconfig,
        **kwargs,
    )

    ts_lint(name = name + "_lint", data = srcs, tags = tags)


def prettier_test(name = None, data = [], args = [], **kwargs):
    _prettier_test(
            name = name,
            data = data + [ "//:.prettierrc.json", "//:.gitignore", "//:.editorconfig" ],
            args = args + ["--config", "$(location //:.prettierrc.json)", "--ignore-path", "$(location //:.gitignore)", "--check"]
    )
