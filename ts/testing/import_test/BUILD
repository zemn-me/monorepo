load("//ts:rules.bzl", "ts_project")
load("//:rules.bzl", "jest_test")

ts_project(
    name = "a",
    srcs = ["a.ts"],
    composite = True,
    incremental = True,
    tsconfig = "//:tsconfig_node",
    deps = [":b"],
)

ts_project(
    name = "b",
    srcs = ["b.ts"],
    composite = True,
    incremental = True,
    tsconfig = "//:tsconfig_node",
)

ts_project(
    name = "import_test_js",
    srcs = ["import_test.ts"],
    composite = True,
    incremental = True,
    tsconfig = "//:tsconfig_node",
    deps = [
        ":a",
        "@npm//@types/jest",
    ],
)

jest_test(
    name = "import_test",
    srcs = ["import_test.js"],
    deps = [":a"],
)
