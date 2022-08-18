load("//ts:rules.bzl", "ts_project")
package(default_visibility = ["//ts/pulumi/dog/pleaseintroducemetoyour:__pkg__"])

ts_project(
    name = "public",
    deps = [
        "@npm//@pulumi/aws",
        "@npm//@pulumi/pulumi",
        "@npm//mime",
    ],
    data = [ "index.html" ]
)