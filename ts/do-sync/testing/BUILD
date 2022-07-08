load("//:rules.bzl", "jest_test", "nodejs_binary", "ts_project")
load("//js/npm:rules.bzl", "npm_pkg")

package(default_visibility = [
    ":__subpackages__",
    "//ts/cmd/svgshot:__subpackages__",
])

ts_project(
    name = "project",
    srcs = glob(["**/*.ts"]),
    project_deps = [
        "//ts/do-sync:project",
    ],
    deps = [
		    "@npm//@types/sharp",
		    "@npm//sharp",
		    "@npm//@types/jest",
    ],
)

jest_test(
    name = "tests",
    srcs = ["doSync_test.ts"],
    project_deps = [":project"],
)
