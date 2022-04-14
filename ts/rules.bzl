load("@npm//@bazel/typescript:index.bzl", _ts_config = "ts_config", _ts_project = "ts_project")
load("//js:rules.bzl", "js_library", "js_test")
load("//lint:rules.bzl", "lint")

# I think what we need here is a custom rule that wraps ts_project and
# does the following:
# - exposes a provider for 'web sources' that is just the source files
# - exposes the providers that ts_project returns

ambient_deps = ["@npm//@types/jest", "//:base_defs"]

def ts_config(**kwargs):
    _ts_config(**kwargs)

def ts_project(name, visibility = None, srcs = None, deps = [], incremental = True, composite = True, tsconfig = "//:tsconfig", declaration = True, **kwargs):
    """
    Declare a set of source files for a typescript project.

    This macro outputs multiple tags. For given name "project", it will create:
        - "project" -- all javascript files; all compiled typescript files and all sources
        - "project_ts" -- just the compiled typescript files
        - "project_js" -- just the compiled javascript files
        - "project_lint_*" -- linting rules for all the sources
    Args:
        name: tag name
        visibility: who gets to use it
        srcs: list of sources
        deps: list of deps
        incremental: use incremental ts compilation (recommended)
        composite: use composite ts compilation (recommended)
        tsconfig: set custom tsconfig
        declaration: output delcaration files (recommended)
        **kwargs: everything else!
    """
    if srcs == None:
        srcs = native.glob(["**/*.ts", "**/*.tsx"])

    tsfiles = []

    for src in srcs:
        if src.endswith(".ts") or src.endswith(".tsx"):
            tsfiles.append(src)

    if tsfiles:
        _ts_project(
            name = name + "_ts",
            srcs = srcs,
            deps = deps + ambient_deps,
            composite = composite,
            declaration = declaration,
            tsconfig = tsconfig,
            incremental = incremental,
            link_workspace_root = True,
            resolve_json_module = True,
            visibility = visibility,
            **kwargs
        )

    #else:
    #native.alias(name = name + "_ts", actual = name, visibility = visibility)

    js_library(
        name = name + "_js",
        srcs = srcs,
        deps = deps,
        visibility = visibility,
    )

    js_library(
        name = name,
        deps = [name + "_js", name + "_ts"],
        visibility = visibility,
    )

    lint(
        name = name + "_lint",
        srcs = srcs,
    )

def ts_test(deps = [], **kwargs):
    js_test(
        deps = deps + ambient_deps,
        **kwargs
    )
