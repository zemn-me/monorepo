load("//ts/mdx/cmd/mdx-transform:rules.bzl", "mdx_to_js")

def mdx_files(name, srcs = None, **kwargs):
    native.filegroup(
        name = name,
        srcs = srcs,
        **kwargs
    )

    mdx_to_js(
        name = name + "_js",
        srcs = srcs,
        **kwargs
    )
