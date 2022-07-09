load("//ts:rules.bzl", "ts_project")
load("//:rules.bzl", "jest_test")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "math",
    srcs = glob(["*.ts"]),
    composite = True,
    incremental = True,
    deps = [
        "@npm//@types/jest",
    ],
)

jest_test(
    name = "test",
    srcs = [
        "camera_test.js",
        "math_test.js",
    ],
    project_deps = [":math"],
)
