load("//:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "TimeEye",
    project_deps = [
        "//project/zemn.me/bio:bio",
        "//project/linear2/features/elements:elements"
    ],
    srcs = glob([
        "*.ts",
        "*.tsx",
        "*.css",
    ]),
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "@npm//@types/react",
        "@npm//classnames",
        "@npm//react",
    ],
)
