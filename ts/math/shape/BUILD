
load("//ts:rules.bzl", "jest_test", "ts_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_sources(
    name = "srcs",
    srcs = glob(["*.ts"]),
    deps = [
        "@npm//@types/react",
        "@npm//react",
    ]
)

ts_project(
    name = "shape",
    srcs = [ ":srcs" ],
)

ts_test(
    name = "test",
    srcs = [ ":shape" ]
)

