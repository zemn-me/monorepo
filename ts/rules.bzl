load("//js/jest:rules.bzl", _jest_test = "jest_test")
load("//go/fmt:rules.bzl", _test_go_fmt = "test_go_fmt")
load("@io_bazel_rules_go//go:def.bzl", _go_binary = "go_binary", _go_library = "go_library", _go_test = "go_test")
load("@npm//@bazel/typescript:index.bzl", _ts_config = "ts_config", _ts_project = "ts_project")
load("@npm//eslint:index.bzl", _eslint_test = "eslint_test")
load("@build_bazel_rules_nodejs//:index.bzl", "js_library", _nodejs_binary = "nodejs_binary")

def nodejs_binary(link_workspace_root = True, **kwargs):
    _nodejs_binary(link_workspace_root = link_workspace_root, **kwargs)

def ts_config(**kwargs):
    _ts_config(**kwargs)

def jest_test(jsdom = None, deps = [], **kwargs):
    extra_deps = ["@npm//jsdom"] if jsdom else []
    _jest_test(
        deps = deps + extra_deps,
        jest_config = "//ts/jest:config_browser_js" if jsdom else "//ts/jest:config_node_js",
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

def ts_project(name, visibility = None, ignores_lint = [], resolve_json_module = True, srcs = [], incremental = True, composite = True, tsconfig = "//:tsconfig", preserve_jsx = None, root_dir = None, tags = [], **kwargs):
    _ts_project(
        name = name,
        srcs = srcs,
        composite = composite,
        tsconfig = tsconfig,
        preserve_jsx = preserve_jsx,
        incremental = incremental,
        resolve_json_module = resolve_json_module,
        root_dir = root_dir,
        link_workspace_root = True,
        source_map = True,
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

def eslint_test(name = None, data = [], args = [], **kwargs):
    _eslint_test(
        name = name,
        data = data + [
            "//:.prettierrc.json",
            "//:.gitignore",
            "//:.editorconfig",
            "//:.eslintrc.json",
            "@npm//eslint-plugin-prettier",
            "@npm//@typescript-eslint/parser",
            "@npm//@typescript-eslint/eslint-plugin",
            "@npm//eslint-config-prettier",
            "@npm//eslint-plugin-react",
        ],
        args = args + ["--ignore-path", "$(location //:.gitignore)"] +
               ["$(location " + x + ")" for x in data],
    )
