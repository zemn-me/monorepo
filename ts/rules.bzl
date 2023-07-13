load("//js/jest:rules.bzl", _jest_test = "jest_test")
load("@aspect_rules_ts//ts:defs.bzl", _ts_config = "ts_config", _ts_project = "ts_project")
load("//js:rules.bzl", _js_binary = "js_binary")
load("@aspect_rules_swc//swc:defs.bzl", "swc")
load("@bazel_skylib//lib:partial.bzl", "partial")
load("//js/eslint:rules.bzl", "eslint_test")

def js_binary(name, **kwargs):
    _js_binary(name = name, **kwargs)

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
        data = data srcs,
        **kwargs
    )

def ts_project(name, visibility = None, deps = [], ignores_lint = [], resolve_json_module = True, srcs = None, tsconfig = "//:tsconfig", preserve_jsx = None, tags = [], **kwargs):
    if srcs == None:
        srcs = native.glob(["**/*.ts", "**/*.tsx"])

    _ts_project(
        name = name,
        srcs = srcs,
        tsconfig = tsconfig,
        # swc injects this
        deps = deps + ["//:node_modules/regenerator-runtime"],
        transpiler = partial.make(
            swc,
            swcrc = "//:swcrc",
            source_maps = "true",
        ),
        preserve_jsx = preserve_jsx,
        resolve_json_module = resolve_json_module,
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
