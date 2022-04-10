sh_binary(
    name = "lint",
    srcs = ["lint.sh"],
    data = [
        "stylelint-config.json",
        "@npm//stylelint/bin:stylelint",
    ],
    visibility = ["//tools/bazel:__subpackages__"],
    deps = ["@bazel_tools//tools/bash/runfiles"],
)

exports_files([
    "lint.sh",
    "stylelint-config.json",
])
