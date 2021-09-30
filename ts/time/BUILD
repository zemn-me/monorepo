load("//:rules.bzl", "ts_project", "jest_test")
package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "time",
    srcs = glob(["*.ts", "*.tsx"]) + [
        "//css:css_loader.d.ts"
    ],
    deps = [
        "@npm//@types/jest",
        "@npm//ts-toolbelt",
    ],
    project_deps = [ "//ts:ts" ],
    composite = True,
    declaration = True,
    incremental = True,
)

jest_test(
    name = "tests",
    project_deps = [ ":time" ],
    srcs = [ "date_test.js" ]
)

