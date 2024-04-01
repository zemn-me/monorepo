load("@aspect_rules_swc//swc:defs.bzl", "swc")
load("@aspect_rules_ts//ts:defs.bzl", _ts_config = "ts_config", _ts_project = "ts_project")
load("@bazel_skylib//lib:partial.bzl", "partial")
load("@bazel_skylib//lib:paths.bzl", "paths")
load("//bzl/lint:linters.bzl", "eslint_test")
load("//js:rules.bzl", _js_binary = "js_binary")
load("//js/jest:rules.bzl", _jest_test = "jest_test")

def js_binary(name, **kwargs):
    _js_binary(name = name, **kwargs)

def ts_config(**kwargs):
    _ts_config(**kwargs)

def jest_test(jsdom = None, srcs = None, deps = [], **kwargs):
    """
    Run jest on a set of files.

    Args:
        jsdom: include a fake browser DOM
        srcs: set of test files to run on (if unspecified, will be the .js versions of all .ts files)
        deps: set of dep files needed when we run the tests
        **kwargs: passed to __jest_test (an aspect_rules_js js_binary macro)
    """
    jest_config = None

    if srcs == None:
        srcs = [paths.replace_extension(p, ".js") for p in native.glob(["*_test.ts"])]

    if jsdom:
        jest_config = "//ts/jest:jest.browser.config.js"
        deps = deps + ["//ts/jest:config_browser"]
    else:
        jest_config = "//ts/jest:jest.node.config.js"
        deps = deps + ["//ts/jest:config_node"]

    _jest_test(
        deps = deps,
        jest_config = jest_config,
        srcs = srcs,
        **kwargs
    )

def ts_lint(name, **kwargs):
    eslint_test(
        name = name,
        **kwargs
    )

def ts_project(name, visibility = None, deps = [], ignores_lint = [], data = [], resolve_json_module = True, srcs = None, tsconfig = "//:tsconfig", preserve_jsx = None, tags = [], **kwargs):
    if srcs == None:
        srcs = native.glob(["**/*.ts", "**/*.tsx"])

    # needed because package.json tells node it can use ESM resolution at runtime
    # and all code is now esm.
    data = data + ["//:package_json"]
    srcs = srcs + ["//:package_json"]

    # swc injects this
    deps = deps + ["//:node_modules/regenerator-runtime"]

    _ts_project(
        name = name,
        srcs = srcs,
        data = data,
        tsconfig = tsconfig,
        deps = deps,
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

    ts_lint(name = name + "_lint", srcs = [name + "_typings"], tags = tags)
