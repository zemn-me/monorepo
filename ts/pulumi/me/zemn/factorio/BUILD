load("//ts:rules.bzl", "ts_project")

package(default_visibility = ["//ts/pulumi/me/zemn:__pkg__"])

ts_project(
    name = "factorio",
    deps = [
        "@npm//@pulumi/aws",
        "@npm//@pulumi/pulumi",
    ],
    data = [ "startupScript.sh", "map.zip" ]
)

