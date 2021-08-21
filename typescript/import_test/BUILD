load("//:rules.bzl", "ts_project", "jest_test")

ts_project(
    name = "a",
    srcs = ["a.ts"],
    declaration = True,
    source_map = True,
    tsconfig = "//:tsconfig",
    deps = [":b"],
)

ts_project(
    name = "b",
    srcs = ["b.ts"],
    declaration = True,
    source_map = True,
    tsconfig = "//:tsconfig",
)

ts_project(
    name = "import_test_js",
    srcs = ["import_test.ts"],
    declaration = True,
    source_map = True,
    tsconfig = "//:tsconfig",
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
