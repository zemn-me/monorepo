load("//tools/jest:jest.bzl",  _jest_test = "jest_test")
load("@npm//@bazel/typescript:index.bzl", _ts_project = "ts_project")
load("@npm//eslint:index.bzl", _eslint_test = "eslint_test")
load("@npm//@bazel/typescript:index.bzl", _ts_config = "ts_config")
load("@build_bazel_rules_nodejs//:index.bzl", _nodejs_binary = "nodejs_binary", "js_library")

def nodejs_binary(**kwargs):
    _nodejs_binary(**kwargs)

def ts_config(**kwargs):
    _ts_config(**kwargs)

def jest_test(project_deps = [], deps = [], **kwargs):
    _jest_test(
        deps = deps + [ x + "_js" for x in project_deps ],
        **kwargs
    )

def ts_lint(name, srcs = [], tags = [], data = [], **kwargs):
    targets = srcs + data
    eslint_test(
            name = name,
            data = targets,
            tags = tags + ["+formatting"],
            args = ["$(location %s)" % x for x in targets],
            **kwargs
    )


def ts_project(name, project_deps = [], deps = [], srcs = [], incremental = None, composite = False, tsconfig = "//:tsconfig", declaration = False, preserve_jsx = None, **kwargs):
    __ts_project(
        name = name + "_ts",
        deps = deps + [dep + "_ts" for dep in project_deps ],
        srcs = srcs,
        composite = composite,
        declaration = declaration,
        tsconfig = tsconfig,
        preserve_jsx = preserve_jsx,
        incremental = incremental,
        **kwargs
    )

    js_library(
        name = name + "_js",
        deps = [ dep + "_js" for dep in project_deps ] + deps,
        srcs = [ src[:src.rfind(".")] + ".js" for src in srcs ],
        **kwargs
    )


def __ts_project(name, tags = [], deps = [], srcs = [], tsconfig = "//:tsconfig", **kwargs):
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

def eslint_test(name = None, data = [], args = [], **kwargs):
    _eslint_test(
        name = name,
        data = data + [
            "//:.prettierrc.json",
            "//:.gitignore",
            "//:.editorconfig",
            "//:.eslintrc.json",

            "@npm//eslint-plugin-prettier", "@npm//@typescript-eslint/parser",
            "@npm//@typescript-eslint/eslint-plugin", "@npm//eslint-config-prettier"
        ],
        args = args + [ "--ignore-path", "$(location //:.gitignore)" ] +
            [ "$(location " + x + ")" for x in data ]
    )

