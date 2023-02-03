load("@build_bazel_rules_nodejs//:index.bzl", _generated_file_test = "generated_file_test", _js_library = "js_library", _nodejs_binary = "nodejs_binary", _nodejs_test = "nodejs_test")

def generated_file_test(name, **kwargs):
    _generated_file_test(name = name, **kwargs)

def nodejs_binary(name, link_workspace_root = True, **kwargs):
    _nodejs_binary(name = name, link_workspace_root = link_workspace_root, **kwargs)

def nodejs_test(name, link_workspace_root = True, **kwargs):
    _nodejs_test(name = name, link_workspace_root = link_workspace_root, **kwargs)

def js_library(name, **kwargs):
    _js_library(name = name, **kwargs)
