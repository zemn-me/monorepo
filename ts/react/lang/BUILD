load("//:rules.bzl", "ts_project", "jest_test")
package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "lang",
    srcs = glob(["*.ts", "*.tsx"]),
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_jsx",
    resolve_json_module = True,
    deps = [ "@npm//react", "@npm//@types/react", "@npm//react-dom",
    "@npm//@types/react-dom", "@npm//@types/jest" ]
)



