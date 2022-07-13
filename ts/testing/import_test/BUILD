load("//ts:rules.bzl", "jest_test", "ts_project")

ts_project(
    name = "a",
    srcs = ["a.ts"],
    tsconfig = "//:tsconfig_node",
    deps = [":b"],
)

ts_project(
    name = "b",
    srcs = ["b.ts"],
    tsconfig = "//:tsconfig_node",
)

ts_project(
    name = "import_test_js",
    srcs = ["import_test.ts"],
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
