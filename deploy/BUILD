load("//:rules.bzl", "nodejs_binary", "ts_project")

package(default_visibility = ["//deploy:__subpackages__"])

# This is a list of build tags which will be uploaded to a github release.
BUILD_ARTIFACTS = {
    "recursive_vassals.zip": "//project/ck3/recursive-vassals:mod_zip",
    "recursive_vassals.patch": "//project/ck3/recursive-vassals:patch",
    "svgshot.tar.gz": "//ts/cmd/svgshot:svgshot.tgz",
}

RELEASE_MESSAGE = "This release contains the following build artifacts:\n" + "\n".join([
    "   - " + output + " ← " + input for output, input in BUILD_ARTIFACTS.items()
])

genrule(
    name = "release_message",
    cmd = "echo '" + RELEASE_MESSAGE + "' > $@ ",
    outs = [ "release_message.txt" ]
)

ts_project(
    name = "release_src",
    srcs = ["release.ts"],
    deps = [
        "@npm//@actions/github",
        "@npm//@types/node",
        "@npm//mime",
        "@npm//commander"
    ],
)

nodejs_binary(
    name = "release",
    data = BUILD_ARTIFACTS.values(),
    entry_point = "release.js",
    templated_args = ["$(rootpaths " + tag + ")" for tag in BUILD_ARTIFACTS.items()],
)

sh_binary(
    name = "deploy",
    srcs = ["deploy.sh"],
    data = [
        "//deploy:release",
        "//project/cultist/multiplayer/deploy:pulumi_prod",
    ],
    env = {
        "PULUMI_CULTIST_MULTIPLAYER": "$(location //project/cultist/multiplayer/deploy:pulumi_prod)",
        "RELEASE": "$(location //deploy:release)",
    },
    deps = ["@bazel_tools//tools/bash/runfiles"],
)
