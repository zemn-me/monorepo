load("//:rules.bzl", "jest_test", "nodejs_binary", "ts_project")
load("//js/npm:rules.bzl", "npm_pkg")

package(default_visibility = [
    "//deploy:__subpackages__",
    "//ts/cmd/svgshot:__subpackages__",
])

ts_project(
    name = "project",
    srcs = glob( [ "**/*.ts" ]),
    deps = [
    ],
    project_deps = [
	"//ts/do-sync:project"
		   ]
)

jest_test(
    name = "tests",
    srcs = ["doSync_test.ts"],
    project_deps = [":project"],
)

