load("//ts:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "math",
    srcs = glob(["*.ts"]),
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
    deps = [":math"],
)
