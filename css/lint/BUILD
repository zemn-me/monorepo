load("//css/lint:rules.bzl", "css_lint")

sh_binary(
    name = "lint",
    srcs = ["lint.sh"],
    data = [
        "stylelint-config.json",
        "@npm//stylelint/bin:stylelint",
    ],
    visibility = ["//bzl:__subpackages__"],
    deps = ["@bazel_tools//tools/bash/runfiles"],
)

exports_files([
    "lint.sh",
    "stylelint-config.json",
])
