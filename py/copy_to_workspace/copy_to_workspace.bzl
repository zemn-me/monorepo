load("//bzl/binary_with_args:binary_with_args.bzl", "binary_with_args")

def copy_to_workspace(
    name,
    src, # bazel output to copy
    dst # where to put it in the repo
):
    binary_with_args(
        name = name,
        binary = "//py/copy_to_workspace:copy_to_workspace_bin",
        args = [
            "$(rlocationpath " + src + ")",
            dst
        ],
        data = [
            src
        ]
    )
