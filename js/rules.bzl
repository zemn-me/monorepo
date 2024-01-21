load("@aspect_rules_js//js:defs.bzl", _js_binary = "js_binary", _js_library = "js_library", _js_run_binary = "js_run_binary", _js_test = "js_test")
load("@aspect_rules_js//npm:defs.bzl", _npm_link_package = "npm_link_package", _pkg_npm = "npm_package")
load("@aspect_bazel_lib//lib:copy_to_bin.bzl", _copy_to_bin = "copy_to_bin")
load("//js/copy_to_local:copy_to_local.bzl", _copy_to_local = "copy_to_local")

def js_binary(name, data = [], **kwargs):
    _js_binary(name = name, data = data + [ "//js:mandatory_data" ], **kwargs)

def js_test(name, data = [], **kwargs):
    _js_test(name = name, data = data + [ "//js:mandatory_data" ], **kwargs)

def js_library(name, **kwargs):
    _js_library(name = name, **kwargs)

def copy_to_bin(name, **kwargs):
    _copy_to_bin(name = name, **kwargs)

def pkg_npm(name, **kwargs):
    _pkg_npm(name = name, **kwargs)

def js_run_binary(name, srcs = [], **kwargs):
    _js_run_binary(name = name, srcs = srcs + [ "//js:mandatory_data" ], **kwargs)

def npm_link_package(name, **kwargs):
    _npm_link_package(name = name, **kwargs)

def copy_to_local(name, **kwargs):
    _copy_to_local(name = name, **kwargs)
