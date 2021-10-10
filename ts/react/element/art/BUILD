load("//:rules.bzl", "ts_project", "jest_test")
package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "art",
    srcs = glob(["*.ts", "*.tsx"]),
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_jsx",
    resolve_json_module = True,
)



