load("//ts:rules.bzl", "jest_test", "nodejs_binary", "ts_project")
load("@bazel_skylib//rules:native_binary.bzl", "native_test")

package(default_visibility = ["//deploy:__subpackages__"])

filegroup(
    name = "pulumi_files",
    srcs = [
        "Pulumi.prod.yaml",
        "Pulumi.yaml",
    ],
)

ts_project(
    name = "pulumi",
    deps = [
        "//ts/pulumi/dog",
        "//ts/pulumi/im",
        "//ts/pulumi/im/shadwell/thomas",
        "//ts/pulumi/me",
        "@npm//@types/cross-spawn",
        "@npm//@types/jest",
        "@npm//cross-spawn",
    ],
)

jest_test(
    name = "tests",
    srcs = ["pulumi_test.js"],
    deps = [":pulumi"],
)

nodejs_binary(
    name = "preview",
    data = [
        ":pulumi",
        ":pulumi_files",
    ],
    entry_point = "preview.js",
)
