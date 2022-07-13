load("//ts:rules.bzl", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "elements",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    resolve_json_module = True,
    deps = [
        "//ts/react/element/link",
    ],
)
