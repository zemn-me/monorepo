load("//ts:rules.bzl", "jest_test", "ts_project")
load("//:rules.bzl", "nodejs_binary")
load("//js/npm:rules.bzl", "npm_pkg")

package(default_visibility = [
    "//deploy:__subpackages__",
    "//ts/cmd/svgshot:__subpackages__",
])

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
        ":project",
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
    deps = [":project"],
)

npm_pkg(
    name = "npm_pkg",
    package_name = "svgshot",
    srcs = ["README.md"] + glob(["docs/**/*"]),
    api_lock = ".api.lock",
    entry_point = "lib.ts",
    major_version = "version/MAJOR",
    minor_version = "version/MINOR",
    patch_version = "version/PATCH",
    pkg_json_base = "package.template.json",
    tgz = "svgshot.tgz",
    version_lock = ".version.lock",
    visibility = ["//deploy:__subpackages__"],
    deps = [":project"],
)
