load("//ts:rules.bzl", "ts_project")

package(default_visibility = ["//ts/pulumi/dog/pleaseintroducemetoyour:__pkg__"])

ts_project(
    name = "public",
    data = ["index.html"],
    deps = [
        "@npm//@bazel/runfiles",
        "@npm//@pulumi/aws",
        "@npm//@pulumi/pulumi",
        "@npm//@types/mime",
        "@npm//mime",
    ],
)
