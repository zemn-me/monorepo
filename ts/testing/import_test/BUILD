load("//:rules.bzl", "jest_test", "ts_config", "ts_project")

ts_project(
    name = "a",
    srcs = ["a.ts"],
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_node",
    project_deps = [":b"],
)

ts_project(
    name = "b",
    srcs = ["b.ts"],
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_node",
)

ts_project(
    name = "import_test_js",
    srcs = ["import_test.ts"],
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_node",
    project_deps = [
        ":a"
    ],
    deps = [
        "@npm//@types/jest",
    ],
)

jest_test(
    name = "import_test",
    srcs = ["import_test.js"],
    deps = [":a_js"],
)
