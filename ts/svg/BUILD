load("//ts:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_sources(
    name = "srcw",
    srcs = glob(["*.ts", "*.tsx"])
)

ts_project(
    name = "svg",
    srcs = [ ":srcs" ],
)

ts_test(
    name = "test",
    srcs = [ ":svg" ]
)
