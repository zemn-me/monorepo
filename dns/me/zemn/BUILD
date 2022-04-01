load("//:rules.bzl", "ts_project")

ts_project(
    name = "zemn",
    srcs = glob(["*.ts", "*.json"]),
    deps = [
        "@npm//@pulumi/aws",
        "@npm//@pulumi/pulumi",
    ],
    visibility = [
        "//:__subpackages__"
    ]
)