load("//ts:rules.bzl", "ts_project")

package(default_visibility = ["//ts/pulumi/im/shadwell/thomas:__pkg__"])

ts_project(
    name = "public",
    data = ["index.html"],
    deps = [
        "//ts/pulumi/lib",
        "@npm//@bazel/runfiles",
        "@npm//@pulumi/aws",
        "@npm//@pulumi/pulumi",
        "@npm//@types/mime",
        "@npm//mime",
    ],
)
