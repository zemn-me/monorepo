load("//:rules.bzl", "ts_project", "jest_test")
package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "url",
    srcs = glob(["*.ts", "*.tsx"]),
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_jsx",
    resolve_json_module = True,
    deps = [ "@npm//react", "@npm//@types/react" , "@npm//@types/jest"]
)

jest_test(
    name = "url",
    project_deps = [ ":url" ],
    srcs = [ "url_test.js" ],
    jsdom = True
)


