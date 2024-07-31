"rules for css modules."

load("//js:rules.bzl", "js_library")

def css_module(name, srcs = []):
    js_library(
        name = name,
        srcs = srcs,
        deps = [
            "//:base_defs",
        ],
    )
