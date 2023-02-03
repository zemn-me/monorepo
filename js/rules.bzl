load("@aspect_rules_js//:index.bzl", _generated_file_test = "generated_file_test", _js_library = "js_library", _nodejs_binary = "nodejs_binary", _nodejs_test = "nodejs_test", _copy_to_bin = "copy_to_bin", _pkg_npm = "pkg_npm")

def generated_file_test(name, **kwargs):
    _generated_file_test(name = name, **kwargs)

def nodejs_binary(name, link_workspace_root = True, **kwargs):
    _nodejs_binary(name = name, link_workspace_root = link_workspace_root, **kwargs)

def nodejs_test(name, link_workspace_root = True, **kwargs):
    _nodejs_test(name = name, link_workspace_root = link_workspace_root, **kwargs)

def js_library(name, **kwargs):
    _js_library(name = name, **kwargs)

def copy_to_bin(name, **kwargs):
    _copy_to_bin(name = name, **kwargs)

def pkg_npm(name, **kwargs):
    _pkg_npm(name = name, **kwargs)
