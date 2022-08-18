load("//ts:rules.bzl", "nodejs_binary", "ts_project")

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
        "//ts/pulumi/me",
        "@npm//@types/cross-spawn",
        "@npm//cross-spawn",
    ],
)

nodejs_binary(
    name = "run",
    data = [
        ":pulumi",
        ":pulumi_files",
        "//bin/linux/pulumi",
    ],
    entry_point = "run.js",
    env = {
        "PULUMI_BIN": "$(rootpath //bin/linux/pulumi)",
    },
)
