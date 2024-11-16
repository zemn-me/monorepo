load("//bzl/lint:linters.bzl", "eslint_test")
load("//js:rules.bzl", "js_library")
load("//ts/mdx/cmd/mdx-transform:rules.bzl", "mdx_to_js")

def mdx_files(name, srcs = None, visibility = None, **kwargs):
    native.filegroup(
        name = name,
        srcs = srcs,
        visibility = visibility,
    )

    js_library(
        name = name + "_mdx_files_js_library",
        srcs = srcs,
    )

    eslint_test(
        name = name + "_lint",
        srcs = [name + "_mdx_files_js_library"],
    )

    mdx_to_js(
        name = name + "_js",
        srcs = srcs,
        visibility = visibility,
        **kwargs
    )
