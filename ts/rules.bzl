load("//js/jest:rules.bzl", _jest_test = "jest_test")
load("@npm//@bazel/typescript:index.bzl", _ts_config = "ts_config", _ts_project = "ts_project")
load("@build_bazel_rules_nodejs//:index.bzl", _nodejs_binary = "nodejs_binary")
load("@aspect_rules_swc//swc:defs.bzl", "swc_transpiler")
load("@bazel_skylib//lib:partial.bzl", "partial")
load("//js/eslint:rules.bzl", "eslint_test")

def nodejs_binary(link_workspace_root = True, **kwargs):
    _nodejs_binary(link_workspace_root = link_workspace_root, **kwargs)

def ts_config(**kwargs):
    _ts_config(**kwargs)

def jest_test(jsdom = None, deps = [], **kwargs):
    jest_config = None
    if jsdom:
        jest_config = "//ts/jest:jest.browser.config.js"
        deps = deps + ["//ts/jest:config_browser"]
    else:
        jest_config = "//ts/jest:jest.node.config.js"
        deps = deps + ["//ts/jest:config_node"]

    _jest_test(
        deps = deps,
        jest_config = jest_config,
        **kwargs
    )

def ts_lint(name, srcs = [], data = [], **kwargs):
    eslint_test(
        name = name,
        data = data + ["//:tsconfig"],
        srcs = srcs,
        **kwargs
    )

def ts_project(name, visibility = None, deps = [], ignores_lint = [], resolve_json_module = True, srcs = None, incremental = True, tsconfig = "//:tsconfig", preserve_jsx = None, root_dir = None, tags = [], **kwargs):
    if srcs == None:
        srcs = native.glob(["**/*.ts", "**/*.tsx"])
    _ts_project(
        name = name,
        srcs = srcs,
        tsconfig = tsconfig,
        # swc injects this
        deps = deps + ["@npm//regenerator-runtime"],
        transpiler = partial.make(
            swc_transpiler,
            swcrc = "//:swcrc",
            source_maps = "true",
        ),
        preserve_jsx = preserve_jsx,
        resolve_json_module = resolve_json_module,
        root_dir = root_dir,
        link_workspace_root = True,
        declaration = True,
        declaration_map = True,
        visibility = visibility,
        **kwargs
    )

    ts_lint(name = name + "_lint", data = [
        x
        for x in srcs
        if x not in ignores_lint and
           (x[-len(".ts"):] == ".ts" or x[-len(".tsx"):] == ".tsx")
    ], tags = tags)

