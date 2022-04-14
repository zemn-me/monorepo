load("//ts:rules.bzl", "ts_project", "ts_test")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "time",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    deps = ["@npm//ts-toolbelt"],
)

ts_test(
    name = "test",
    srcs = [":time"],
)
