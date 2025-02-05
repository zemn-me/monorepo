def binary_with_args(name, binary, args, data = [], test = False, **kwargs):
    rule = native.sh_binary
    if test:
        rule = native.sh_test

    rule(
        name = name,
        srcs = ["//bzl/binary_with_args:binary_with_args.sh"],
        data = [
            binary,
        ] + data,
        args = [
            "$(rlocationpath " + binary + ")",
        ] + args,
        deps = [
            "@bazel_tools//tools/bash/runfiles",
        ],
        **kwargs
    )
