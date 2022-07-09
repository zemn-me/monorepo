load("//ts:rules.bzl", "ts_project")
load("//:rules.bzl", "jest_test")

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
    project_deps = [":project"],
)
