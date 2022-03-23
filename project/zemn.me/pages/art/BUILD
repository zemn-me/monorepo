load("//:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "art",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    project_deps = [
        "//project/zemn.me/elements/ZemnmezLogo:ZemnmezLogo"
    ],
    deps = [
        "@npm//@types/react",
        "@npm//react",
        "@npm//react-router-dom",
        "@npm//react-dom",
    ],
    tsconfig = "//:tsconfig_jsx",
)
