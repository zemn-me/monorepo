load("//ts:rules.bzl", "ts_project", "ts_test")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "math",
    srcs = glob(["*.ts"]),
)

ts_test(
    name = "test",
    srcs = [":math"],
)
