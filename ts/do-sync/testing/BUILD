load("//:rules.bzl", "jest_test", "ts_project")

ts_project(
    name = "project",
    srcs = glob(["**/*.ts"]),
    project_deps = [
        "//ts/do-sync:project",
    ],
    deps = [
        "@npm//@types/cross-spawn",
        "@npm//@types/jest",
        "@npm//@types/node",
        "@npm//@types/sharp",
        "@npm//cross-spawn",
        "@npm//sharp",
    ],
)

jest_test(
    name = "tests",
    srcs = ["doSync_test.ts"],
    project_deps = [":project"],
)
