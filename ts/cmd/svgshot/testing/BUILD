load("//ts:rules.bzl", "jest_test", "ts_project")

ts_project(
    name = "project",
    srcs = glob(["*.ts"]),
    deps = [
        "@npm//@types/jest",
        "@npm//@types/node",
    ],
)

jest_test(
    name = "tests",
    srcs = ["do_not_depend_on_typescript_test.js"],
    data = ["//ts/cmd/svgshot:package.json"],
    deps = [":project"],
)
