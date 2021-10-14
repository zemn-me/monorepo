load("//:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "elements",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]) + [
        "//css:css_loader.d.ts",
    ],
    composite = True,
    declaration = True,
    incremental = True,
    project_deps = [
        "//ts/react/element/link:link",
    ],
    resolve_json_module = True,
    tsconfig = "//:tsconfig_jsx",
)
