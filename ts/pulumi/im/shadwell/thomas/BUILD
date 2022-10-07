load("//ts:rules.bzl", "ts_project")

#package(default_visibility = ["//ts/pulumi/im/shadwell:__pkg__"])
package(default_visibility = ["//visibility:public"])

ts_project(
    name = "thomas",
    deps = [
        "//ts/pulumi/im/shadwell/cert",
        "//ts/pulumi/im/shadwell/thomas/public",
        "//ts/pulumi/lib",
        "@npm//@pulumi/aws",
    ],
)
