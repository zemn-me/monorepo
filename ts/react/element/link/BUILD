load("//ts:rules.bzl", "ts_project", "ts_test")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "link",
    srcs = glob(["*.ts"]),
    deps = [
        "@npm//@types/react",
        "@npm//react",
        "@npm//react-dom",
    ],
)

ts_test(
    name = "test",
    srcs = [":link"],
)

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "link",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    composite = True,
    declaration = True,
    incremental = True,
    project_deps = ["//ts/url:url"],
    resolve_json_module = True,
    tsconfig = "//:tsconfig_jsx",
    deps = [
    ],
)

ts_test(
    name = "tests",
    srcs = ["link_test.js"],
    jsdom = True,
    project_deps = [":link"],
)
