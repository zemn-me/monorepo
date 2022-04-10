load("//ts:rules.bzl", "jest_test", "ts_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "math",
    srcs = glob(["*.ts"])
)

ts_test(
    name = "test",
    srcs = [ ":math" ]
)
