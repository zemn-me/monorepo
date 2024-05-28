load("//ts/mdx/cmd/mdx-transform:rules.bzl", "mdx_to_js")

def mdx_files(name, srcs = None, visibility = None, **kwargs):
    native.filegroup(
        name = name,
        srcs = srcs,
        visibility = visibility,
    )

    mdx_to_js(
        name = name + "_js",
        srcs = srcs,
        visibility = visibility,
        **kwargs
    )
