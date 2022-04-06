load("@npm//@bazel/typescript:index.bzl", _ts_config = "ts_config", _ts_project = "ts_project")
load("//js:rules.bzl", "js_library", "js_test")
load("//lint:rules.bzl", "lint")

ambient_deps = [ "@npm//@types/jest" ]

def ts_config(**kwargs):
    _ts_config(**kwargs)

# maybe this should be called web_sources?
def ts_sources(name = None, srcs = [], **kwargs):
    js_library(
        name = name,
        srcs = srcs,
        **kwargs
    )
    
    lint(
        name = name,
        srcs = srcs
    )

def ts_project(deps = [], incremental = True, composite = True, tsconfig = "//:tsconfig", declaration = True, **kwargs):
    _ts_project(
        deps = deps + ambient_deps,
        composite = composite,
        declaration = declaration,
        tsconfig = tsconfig,
        incremental = incremental,
        link_workspace_root = True,
        **kwargs
    )

def ts_test(deps = [], **kwargs):
    js_test(
        deps = deps + ambient_deps,
        **kwargs)