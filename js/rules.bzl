load("@build_bazel_rules_nodejs//:index.bzl", _js_library = "js_library", nodejs_binary = "nodejs_binary") 
load("//lint:rules.bzl", "lint")
load("//tools/jest:jest.bzl", jest_test = "jest_test")

def js_binary(name = None, **kwargs):
    nodejs_binary(
        name = name,
        link_workspace_root = True,
        **kwargs
    )


def js_library(name = None, srcs = [], **kwargs):
    _js_library(
        name = name, srcs = srcs,
        **kwargs
    )

def js_test(deps = [], **kwargs):
    jest_test(
        deps = deps + [ "@npm//jsdom" ],
        jest_config = "//:jest_config_browser",
        **kwargs
    )