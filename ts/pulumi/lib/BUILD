load("//ts:rules.bzl", "ts_project")

package(default_visibility = ["//visibility:public"])

ts_project(
    name = "lib",
    deps = [
        "@npm//@bazel/runfiles",
        "@npm//@pulumi/aws",
        "@npm//@pulumi/pulumi",
        "@npm//@types/node",
        "//ts/iter"
    ],
)
