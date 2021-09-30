load("//:rules.bzl", "ts_project", "jest_test")
package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "math",
    srcs = glob(["*.ts"]),
    deps = [
        "@npm//@types/jest"
    ],
    composite = True,
    declaration = True,
    incremental = True
)

jest_test(
    name = "test",
    project_deps = [ ":math" ],
    srcs = [ "math_test.js", "camera_test.js" ]
)
