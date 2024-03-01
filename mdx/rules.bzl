load("//ts/mdx/cmd/mdx-transform:rules.bzl", "mdx_to_ts")

def mdx_lint(name, srcs = None):
    pass
    #eslint_test(
    #    name = name,
    #    srcs = srcs
    #)

def mdx_files(name, srcs = None):
    #mdx_lint(
    #    name = name + "_lint",
    #    srcs = srcs
    #)

    native.filegroup(
        name = name,
        srcs = srcs,
    )

    mdx_to_ts(
        name = name + "_ts",
        srcs = srcs,
    )
