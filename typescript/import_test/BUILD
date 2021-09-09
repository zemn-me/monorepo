load("//:rules.bzl", "ts_project", "jest_test", "ts_config")

ts_project(
    name = "a",
    srcs = ["a.ts"],
    declaration = True,
    tsconfig = "//:tsconfig_node",
    deps = [":b"],
)

ts_project(
    name = "b",
    srcs = ["b.ts"],
    declaration = True,
    tsconfig = "//:tsconfig_node",
)

ts_project(
    name = "import_test_js",
    srcs = ["import_test.ts"],
    declaration = True,
    tsconfig = "//:tsconfig_node",
    deps = [
        ":a",
        "@npm//@types/jest"
    ],
)

jest_test(
    name = "import_test",
    srcs = ["import_test.js"],
    deps = [ ":a" ]
)

