load("//:rules.bzl", "ts_project")
load("//ts/pulumi:rules.bzl", "pulumi")

sh_binary(
    name = "deploy",
    srcs = ["deploy.sh"],
    data = ["//project/cultist/multiplayer/deploy:pulumi_prod"],
    env = {
        "DEPLOY_BINARY": "$(location //project/cultist/multiplayer/deploy:deploy_prod)",
    },
    deps = ["@bazel_tools//tools/bash/runfiles"],
)

ts_project(
    name = "deploy_ts",
    project_deps = [
        "//dns/me/zemn:zemn",
        "//project/cultist/multiplayer/deploy:deploy"
    ],
    srcs = glob(["*.ts"])
)

pulumi(
    name = "deploy",
    stacks = [
        "//:Pulumi.prod.yaml",
    ],
    config_files = [
        "//:Pulumi.yaml",
        ":deploy_ts_sources"
    ]
)
