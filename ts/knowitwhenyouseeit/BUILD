load("//ts:rules.bzl", "jest_test", "ts_project")
load("@build_bazel_rules_nodejs//:index.bzl", "js_library")
load("//:rules.bzl", "nodejs_binary")
load("//js/npm:rules.bzl", "npm_pkg")

package(default_visibility = [
    "//deploy:__subpackages__"
])

ts_project(
    name = "project",
    srcs = [
        "index.ts"
    ],
    deps = [
        "@npm//cross-env",
        "@npm//@types/node",
        "@npm//react",
        "@npm//react-dom",
        "@npm//bcryptjs",
        "@npm//@types/bcryptjs"
    ],
)

ts_project(
    name = "tests_js",
    srcs = ["test.ts"],
    deps = [
        ":project",
    ],
)

jest_test(
    name = "tests",
    srcs = ["test.js"],
    deps = [":tests_js"],
)

npm_pkg(
    name = "npm_pkg",
    package_name = "knowitwhenyouseeit",
    readme = "README.md",
    api_lock = ".api.lock",
    entry_point = "index.ts",
    major_version = "version/major",
    minor_version = "version/minor",
    patch_version = "version/patch",
    pkg_json_base = "package.template.json",
    tgz = "knowitwhenyouseeit.tgz",
    version_lock = ".version.lock",
    visibility = ["//deploy:__subpackages__"],
    deps = [":project"],
)
