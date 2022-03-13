

sh_binary(
    name = "deploy",
    data = [ "//project/cultist/multiplayer/deploy:pulumi_prod" ],
    args = [ "$(location //project/cultist/multiplayer/deploy:pulumi_prod)" ],
    srcs = [ "deploy.sh" ],
    deps = ["@bazel_tools//tools/bash/runfiles"],
)