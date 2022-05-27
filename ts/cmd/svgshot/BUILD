load("//:rules.bzl", "jest_test", "nodejs_binary", "ts_project")
load("@build_bazel_rules_nodejs//:index.bzl", "pkg_npm")
load("//js/npm/package_json:rules.bzl", "package_json")

ts_project(
    name = "project",
    srcs = [
        "index.ts",
        "lib.ts",
        "svgshot_test.ts",
    ],
    deps = [
        "@npm//@bazel/runfiles",
        "@npm//@types/jest",
        "@npm//@types/node",
        "@npm//@types/svgo",
        "@npm//@types/tmp",
        "@npm//commander",
        "@npm//puppeteer",
        "@npm//svgo",
        "@npm//tmp",
    ],
)

nodejs_binary(
    name = "svgshot",
    args = [
        "--inkscapeBin",
        "$(location //cc/inkscape:bin)",
    ],
    data = [
        ":project_ts",
        "//cc/inkscape:bin",
    ],
    entry_point = "index.ts",
)

jest_test(
    name = "tests",
    srcs = ["svgshot_test.js"],
    data = [
        "//cc/inkscape:bin",
    ],
    project_deps = [":project"],
)

pkg_npm(
    name = "npm_pkg",
    package_name = "svgshot",
    srcs = ["package.json"],
    deps = [
        "index.js",
        "lib.js",
    ],
)

package_json(
    name = "package_json",
    target = ":project_js",
    template = ":package.template.json",
)
