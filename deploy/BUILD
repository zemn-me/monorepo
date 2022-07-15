load("//ts:rules.bzl", "ts_project")
load("//:rules.bzl", "nodejs_binary")

package(default_visibility = ["//deploy:__subpackages__"])

# This is a list of build tags which will be uploaded to a github release.
BUILD_ARTIFACTS = {
    "recursive_vassals.zip": "//project/ck3/recursive-vassals:mod_zip",
    "recursive_vassals.patch": "//project/ck3/recursive-vassals:patch",
    "svgshot.tar.gz": "//ts/cmd/svgshot:svgshot.tgz",
}

RELEASE_MESSAGE = "This release contains the following build artifacts:\n" + "\n".join([
    "   - " + output + " ← " + input
    for output, input in BUILD_ARTIFACTS.items()
])

genrule(
    name = "release_message",
    outs = ["release_message.txt"],
    cmd = "echo '" + RELEASE_MESSAGE + "' > $@ ",
)

ts_project(
    name = "release_src",
    srcs = ["release.ts"],
    deps = [
        "@npm//@actions/github",
        "@npm//@types/node",
        "@npm//commander",
        "@npm//mime",
    ],
)

nodejs_binary(
    name = "release",
    data = BUILD_ARTIFACTS.values() + [
        ":release_message",
        "//ts/cmd/svgshot:npm_pkg.publish",
    ],
    entry_point = "release.js",
    templated_args = [
        "--body",
        "$(rootpath :release_message )",
    ] + ["$(rootpaths " + tag + ")" for (name, tag) in BUILD_ARTIFACTS.items()],
)

alias(
    name = "deploy",
    actual = "release"
)