"Group and lint JSON files."

load("//bzl/format:format.bzl", "prettier_format_test")

def json_files(name, srcs = None):
    native.filegroup(
        name = name,
        srcs = srcs,
    )

    prettier_format_test(
        name = name + "_format_test",
        srcs = srcs,
    )
