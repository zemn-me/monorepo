load("//ts:rules.bzl", "ts_project", "ts_test")

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
    ],
)

ts_test(
    name = "import_test",
    srcs = ["import_test.js"],
    deps = [":a_js"],
)
