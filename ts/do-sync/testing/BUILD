load("//ts:rules.bzl", "jest_test", "ts_project")
load("//js/npm:rules.bzl", "npm_pkg")

package(default_visibility = [
    ":__subpackages__",
    "//ts/cmd/svgshot:__subpackages__",
])

ts_project(
    name = "project",
    srcs = glob(["**/*.ts"]),
    deps = [
		    "//ts/do-sync",
		    "@npm//@types/sharp",
		    "@npm//sharp",
		    "@npm//@types/jest",
    ],
)

jest_test(
    name = "tests",
    srcs = ["doSync_test.js"],
    deps = [ ":project" ]
)
