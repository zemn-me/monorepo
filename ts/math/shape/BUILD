load("//ts:rules.bzl", "ts_project", "ts_test")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "shape",
    srcs = glob(["*.ts"]),
    deps = [
        "//ts/math",
        "//ts/math/canvas",
        "@npm//@types/react",
        "@npm//react",
    ],
)

ts_test(
    name = "test",
    srcs = [":shape"],
)
