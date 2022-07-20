load("//ts:rules.bzl", "jest_test", "ts_project")
load("//:rules.bzl", "nodejs_binary")

package(default_visibility = ["//deploy:__subpackages__"])

ts_project(
    name = "release_src",
    srcs = [
        "deploy_test.ts",
        "program.ts",
        "release.ts",
    ],
    data = [
        "//project/ck3/recursive-vassals:mod_zip",
        "//project/ck3/recursive-vassals:patch",
        "//ts/cmd/svgshot:npm_pkg.publish",
        "//ts/cmd/svgshot:svgshot.tgz",
    ],
    deps = [
        "@npm//@actions/github",
        "@npm//@bazel/runfiles",
        "@npm//@types/jest",
        "@npm//@types/node",
        "@npm//commander",
        "@npm//mime",
    ],
)

nodejs_binary(
    name = "release",
    data = [":release_src"],
    entry_point = "release.js",
)

alias(
    name = "deploy",
    actual = "release",
)

jest_test(
    name = "test",
    srcs = ["deploy_test.js"],
    deps = [":release_src"],
)
