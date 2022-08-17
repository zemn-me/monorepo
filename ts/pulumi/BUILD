load("//ts:rules.bzl", "nodejs_binary", "ts_project")

package(default_visibility = ["//deploy:__subpackages__"])

TS_FILES = glob(["**/*.ts"])

filegroup(
    name = "ts_files",
    srcs = TS_FILES,
)

filegroup(
    name = "pulumi_files",
    srcs = [
        "Pulumi.prod.yaml",
        "Pulumi.yaml",
        ":ts_files",
    ],
)

ts_project(
    name = "lib",
    srcs = TS_FILES,
    deps = [
        "@npm//@bazel/runfiles",
        "@npm//@pulumi/aws",
        "@npm//@pulumi/pulumi",
        "@npm//cross-spawn",
    ],
)

nodejs_binary(
    name = "run",
    data = [
        ":lib",
        ":pulumi_files",
        "//bin/linux/pulumi",
    ],
    entry_point = "run.js",
    env = {
        "PULUMI_BIN": "$(rootpath //bin/linux/pulumi)",
    },
)
