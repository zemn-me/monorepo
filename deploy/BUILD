sh_binary(
    name = "deploy",
    srcs = ["deploy.sh"],
    data = ["//project/cultist/multiplayer/deploy:pulumi_prod"],
    env = {
        "PULUMI_CULTIST_MULTIPLAYER": "$(location //project/cultist/multiplayer/deploy:pulumi_prod)",
    },
    deps = ["@bazel_tools//tools/bash/runfiles"],
)
