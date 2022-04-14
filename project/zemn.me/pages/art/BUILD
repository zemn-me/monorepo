load("//ts:rules.bzl", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "art",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    deps = [
        "//project/zemn.me/elements/ZemnmezLogo",
        "@npm//react",
        "@npm//react-router-dom",
    ],
)
