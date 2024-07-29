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

def ts_project(name, visibility = None, lint = True, deps = [], data = [], resolve_json_module = True, srcs = None, tsconfig = "//:tsconfig", preserve_jsx = None, tags = [], **kwargs):
    """
    Compile a set of typescript files, dependencies, runtime data and other source files into typescript types and source maps.

    Also generates an _typings tag (typescript types) and an _lint tag
    (lint tests).

    Note that there isn't a way to exempt specific files from aspect_rules_lint as I can see,
    so deps which are invalid eslint files should instead use an /* eslint-disable */ comment.

    Args:
        name: build tag name
        visibility: bazel visibility
        deps: ts source file deps
        data: runtime deps
        resolve_json_module: passed to the underlying ts_project
        srcs: typescript source files
        tsconfig: the tsconfig file to use (defaults to //:tsconfig)
        preserve_jsx: passed to the aspect_rules_js ts_project rule
        tags: test tags
        lint: use to skip linting. Do not use this lightly! only needs to be used where the file is HUGE.
        **kwargs: passed to the ts_project rule
    """

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
        allow_js = True,
        declaration_map = True,
        visibility = visibility,
        **kwargs
    )

    if lint:
        ts_lint(name = name + "_lint", srcs = [name + "_typings"], tags = tags)
