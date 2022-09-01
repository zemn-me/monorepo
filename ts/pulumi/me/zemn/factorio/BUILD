load("//ts:rules.bzl", "ts_project")

package(default_visibility = ["//ts/pulumi/me/zemn:__pkg__"])

ts_project(
    name = "factorio",
    data = [
        "map.zip",
        "startupScript.sh",
    ],
    deps = [
        "//ts/pulumi/me/zemn/zone",
        "@npm//@pulumi/aws",
        "@npm//@pulumi/pulumi",
    ],
)
