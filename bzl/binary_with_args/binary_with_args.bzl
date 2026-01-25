load("@rules_shell//shell:sh_binary.bzl", "sh_binary")
load("@rules_shell//shell:sh_test.bzl", "sh_test")

def binary_with_args(name, binary, args, data = [], test = False, **kwargs):
    rule = sh_binary
    if test:
        rule = sh_test

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
            "@rules_shell//shell/runfiles",
        ],
        **kwargs
    )
