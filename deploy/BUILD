load("//:rules.bzl", "ts_project")
load("//ts/pulumi:rules.bzl", "pulumi")

sh_binary(
    name = "deploy",
    srcs = ["deploy.sh"],
    data = ["//:deploy_prod"],
    env = {
        "DEPLOY_BINARY": "$(location //:deploy_prod)",
    },
    deps = ["@bazel_tools//tools/bash/runfiles"],
)

ts_project(
    name = "deploy_ts",
    project_deps = [
        "//dns/me/zemn:zemn",
        "//project/cultist/multiplayer/deploy:deploy"
    ],
    srcs = glob(["*.ts"]),
    visibility = [ "//:__subpackages__" ]
)


