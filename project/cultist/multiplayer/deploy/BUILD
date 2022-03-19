load("//:rules.bzl", "ts_config", "ts_project")
load("//ts/pulumi:rules.bzl", "pulumi")

ts_config(
    name = "tsconfig",
    src = "tsconfig.json",
    deps = ["//:tsconfig"],
)

ts_project(
    name = "deploy",
    tsconfig = ":tsconfig",
    srcs = glob(["*.ts"]),
    deps = [
        "@npm//@pulumi/aws",
        "@npm//@pulumi/awsx",
        "@npm//@pulumi/pulumi",
        "@npm//@types/node",
        "@npm//mime",
        "@npm//@types/mime"
    ]
)

pulumi(
    name = "pulumi",
    config_files = [ ":deploy_js", "Pulumi.yaml" ],
    data = [ "//project/cultist/multiplayer:multiplayer_prod_bundle" ],
    stacks = [ "Pulumi.prod.yaml" ],
    env = {
        "DIR_ROOT": "$$(rlocation quickcult/$(rootpath //project/cultist/multiplayer:multiplayer_prod_bundle))"
    },
    visibility = [ "//:__subpackages__" ]
)

