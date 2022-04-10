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

def ts_project(name = None, srcs = [], deps = [], incremental = True, composite = True, tsconfig = "//:tsconfig", declaration = True, **kwargs):
    """
    We want to separately expose the sources (e.g. for direct compilation)
    by esbuild and ts_project doesn't support labels, so we gotta automatically
    make a label. sorry.
    """
    _ts_project(
        name = name,
        srcs = srcs,
        deps = deps + ambient_deps,
        composite = composite,
        declaration = declaration,
        tsconfig = tsconfig,
        incremental = incremental,
        link_workspace_root = True,
        **kwargs
    )

    lint(
        name = name + "_lint",
        srcs = srcs
    )



def ts_test(deps = [], **kwargs):
    js_test(
        deps = deps + ambient_deps,
        **kwargs)