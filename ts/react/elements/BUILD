load("//:rules.bzl", "ts_project", "jest_test")
package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "elements",
    srcs = glob(["*.ts", "*.tsx"]) + [
        "//css:css_loader.d.ts"
    ],
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_jsx",
    project_deps = [
        "//ts/react/elements/link:link",
    ],
    resolve_json_module = True,
)
