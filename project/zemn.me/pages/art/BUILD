load("//:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "art",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    project_deps = [
        "//project/zemn.me/elements/ZemnmezLogo:ZemnmezLogo",
    ],
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "@npm//@types/react",
        "@npm//react",
        "@npm//react-dom",
        "@npm//react-router-dom",
    ],
)
