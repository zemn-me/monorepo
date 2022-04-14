load("//ts:rules.bzl", "ts_project")
load("//ts/pulumi:rules.bzl", "pulumi")

ts_project(
    name = "deploy",
    srcs = glob(["*.ts"]),
    deps = [
        "@npm//@pulumi/aws",
        "@npm//@pulumi/pulumi",
        "@npm//mime",
    ],
)

pulumi(
    name = "pulumi",
    config_files = [
        ":deploy_js",
        "Pulumi.yaml",
    ],
    data = ["//project/cultist/multiplayer:multiplayer_prod_bundle"],
    env = {
        "DIR_ROOT": "$$(rlocation monorepo/$(rootpath //project/cultist/multiplayer:multiplayer_prod_bundle))",
    },
    stacks = ["Pulumi.prod.yaml"],
    visibility = ["//:__subpackages__"],
)
