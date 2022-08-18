load("//ts:rules.bzl", "nodejs_binary", "ts_project")

package(default_visibility = ["//deploy:__subpackages__"])

TS_FILES = glob(["**/*.ts"])

# TODO (?) this can probably be removed so we can use the JS files directly.
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
    name = "pulumi",
    srcs = TS_FILES,
    deps = [
        "//ts/pulumi/dog",
        "//ts/pulumi/me",
        "//ts/pulumi/im"
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
