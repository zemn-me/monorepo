load("//:rules.bzl", "ts_project", "jest_test")
package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "scale",
    srcs = glob(["*.ts", "*.tsx"]),
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_jsx",
    resolve_json_module = True,
    project_deps = [ "//ts:ts" ],
    deps = [ "@npm//@types/jest", "@npm//react", "@npm//@types/react" ]
)

jest_test(
    name = "tests",
    project_deps = [ ":scale" ],
    srcs = [ "scale_test.js" ],
    jsdom = True
)


