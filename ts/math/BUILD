load("//ts:rules.bzl", "jest_test", "ts_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_sources(
    name = "srcs",
    srcs = glob(["*.ts"])
)

ts_project(
    name = "math",
    srcs = [ ":srcs" ],
)

ts_test(
    name = "test",
    srcs = [ ":math" ]
)
