load("//:rules.bzl", "ts_config", "ts_project")

ts_config(
    name = "tsconfig",
    src = "tsconfig.json",
    deps = ["//:tsconfig"],
)

ts_project(
    name = "deploy",
    srcs = glob(["*.ts"]),
    tsconfig = ":tsconfig",
    deps = [
        "@npm//@pulumi/aws",
        "@npm//@pulumi/awsx",
        "@npm//@pulumi/pulumi",
        "@npm//@types/mime",
        "@npm//@types/node",
        "@npm//mime",
    ],
)

