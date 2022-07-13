load("//ts:rules.bzl", "jest_test", "ts_project")

ts_project(
    name = "a",
    srcs = ["a.ts"],
    deps = [":b"],
)

ts_project(
    name = "b",
    srcs = ["b.ts"],
)

ts_project(
    name = "import_test_js",
    srcs = ["import_test.ts"],
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
