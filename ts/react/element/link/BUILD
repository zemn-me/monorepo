load("//:rules.bzl", "ts_project", "jest_test")
package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "link",
    srcs = glob(["*.ts", "*.tsx"]),
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_jsx",
    resolve_json_module = True,
    deps = [ "@npm//react", "@npm//@types/react" , "@npm//@types/jest", "@npm//@types/react-dom",
        "@npm//react-dom"],
    project_deps = [ "//ts/url:url" ]
)

jest_test(
    name = "tests",
    project_deps = [ ":link" ],
    srcs = [ "link_test.js" ],
    jsdom = True
)


