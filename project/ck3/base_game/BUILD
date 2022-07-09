load("//ts:rules.bzl", "eslint_test", "jest_test", "ts_lint", "ts_project")

package(default_visibility = ["//project/ck3:__subpackages__"])

filegroup(
    name = "base_game",
    srcs = glob(
        ["**/*"],
        exclude = ["**/BUILD"],
    ),
)

exports_files(glob(["**/*"]))
