load("@npm//@bazel/typescript:index.bzl", _ts_config = "ts_config", _ts_project = "ts_project")
load("//js:rules.bzl", "js_library", "js_test")
load("//lint:rules.bzl", "lint")

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

def ts_project(resolve_json_module = True, data = [], project_deps = [], deps = [], srcs = [], incremental = True, composite = True, tsconfig = "//:tsconfig", declaration = True, preserve_jsx = None, root_dir = None, **kwargs):
    _ts_project(
        composite = composite,
        declaration = declaration,
        tsconfig = tsconfig,
        preserve_jsx = preserve_jsx,
        incremental = incremental,
        resolve_json_module = resolve_json_module,
        root_dir = root_dir,
        link_workspace_root = True,
        **kwargs
    )

def ts_test(deps = [], **kwargs):
    js_test(
        deps = deps +  [ "@npm//@types/jest" ]
        **kwargs)