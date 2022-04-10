load("@npm//@bazel/typescript:index.bzl", _ts_config = "ts_config", _ts_project = "ts_project")
load("//js:rules.bzl", "js_library", "js_test")
load("//lint:rules.bzl", "lint")

# I think what we need here is a custom rule that wraps ts_project and
# does the following:
# - exposes a provider for 'web sources' that is just the source files
# - exposes the providers that ts_project returns

ambient_deps = [ "@npm//@types/jest" ]



def ts_config(**kwargs):
    _ts_config(**kwargs)

def ts_project(name = None, srcs = None, deps = [], incremental = True, composite = True, tsconfig = "//:tsconfig", declaration = True, **kwargs):
    if srcs == None:
        srcs = native.glob([ "**/*.ts", "**/*.tsx" ])
    _ts_project(
        name = name + "_ts",
        srcs = srcs,
        deps = deps + ambient_deps,
        composite = composite,
        declaration = declaration,
        tsconfig = tsconfig,
        incremental = incremental,
        link_workspace_root = True,
        **kwargs
    )

    js_library(
        name = name,
        srcs = srcs,
        deps = deps
    )

    lint(
        name = name + "_lint",
        srcs = srcs
    )



def ts_test(deps = [], **kwargs):
    js_test(
        deps = deps + ambient_deps,
        **kwargs)