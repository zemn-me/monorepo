"""Rules for markdown source files."""

load("//bzl/lint:linters.bzl", "markdown_references_test")

def md_files(name, srcs = None, refs = [], visibility = None, lint = True, **kwargs):
    if srcs == None:
        srcs = native.glob(["**/*.md"], allow_empty = True)

    native.filegroup(
        name = name,
        srcs = srcs + refs,
        visibility = visibility,
        **kwargs
    )

    if lint:
        markdown_references_test(
            name = name + "_markdown_references_lint",
            srcs = [name],
        )
