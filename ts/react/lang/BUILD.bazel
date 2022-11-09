load("//ts:rules.bzl", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "lang",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    resolve_json_module = True,
    deps = [
        "@npm//@types/jest",
        "@npm//@types/react",
        "@npm//@types/react-dom",
        "@npm//react",
        "@npm//react-dom",
    ],
)
