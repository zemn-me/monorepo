sh_binary(
    name = "deploy",
    srcs = ["deploy.sh"],
    data = [
        "//project/cultist/multiplayer/deploy:pulumi_prod",
        "//deploy/artifacts:release"
    ],
    env = {
        "PULUMI_CULTIST_MULTIPLAYER": "$(location //project/cultist/multiplayer/deploy:pulumi_prod)",
        "ARTIFACT_RELEASE": "$(location //deploy/artifacts:release)"
    },
    deps = ["@bazel_tools//tools/bash/runfiles"],
)
