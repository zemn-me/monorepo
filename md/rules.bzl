load("//mdx:rules.bzl", "mdx_lint")

def md_lint(name, srcs = None, **kwargs):
    mdx_lint(
        name = name,
        srcs = srcs,
        **kwargs
    )

def md_files(name, srcs = None, **kwargs):
    if srcs == None:
        srcs = native.glob(["**/*.md"])

    md_lint(
        name = name + "_lint",
        srcs = srcs
    )

    native.filegroup(
        name = name,
        srcs = srcs,
        **kwargs
    )
