load("//:rules.bzl", "jest_test", "nodejs_binary", "ts_project")
load("//js/npm/package_json:rules.bzl", "npm_pkg")

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

npm_pkg(
    name = "npm_pkg",
    package_name = "svgshot",
    api_lock = "api.lock",
    entry_point = "lib.ts",
    major_version = "version/MAJOR",
    minor_version = "version/MINOR",
    patch_version = "version/PATCH",
    pkg_json_base = "package.template.json",
    deps = [":project_ts"],
    tgz = "svgshot.tgz"
)
