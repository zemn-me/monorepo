load("//:rules.bzl", "ts_config", "ts_project")
load("//ts/pulumi:rules.bzl", "pulumi")

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
    data = [
        "//project/cultist/multiplayer:multiplayer_prod_bundle"
    ],
    visibility = [
        "//:__subpackages__"
    ]
)