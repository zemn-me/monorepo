load("//ts:rules.bzl", "ts_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "svg",
    srcs = glob(["*.ts", "*.tsx"])
)

ts_test(
    name = "test",
    srcs = [ ":svg" ]
)
