load("//ts:rules.bzl", "ts_project", "ts_test")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "svg",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
)

ts_test(
    name = "test",
    srcs = [":svg"],
)
