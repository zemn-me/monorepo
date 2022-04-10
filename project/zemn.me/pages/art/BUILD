load("//ts:rules.bzl", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_sources(
    name = "srcs",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    deps = [
        "//project/zemn.me/elements/ZemnmezLogo:srcs",
        "@npm//@types/react",
        "@npm//react",
        "@npm//react-dom",
        "@npm//react-router-dom",
    ],
)

ts_project(
    name = "art",
    srcs = [":srcs"],
)
