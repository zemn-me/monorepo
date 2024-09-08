"rules for css files"

load("//js:rules.bzl", "js_library")

def css_files(name, srcs = []):
    js_library(
        name = name,
        srcs = srcs,
        deps = [
            "//:base_defs",
        ],
    )
