load("//:rules.bzl", "jest_test", "nodejs_binary", "ts_project")
load("//js/npm:rules.bzl", "npm_pkg")

package(default_visibility = [
    "//deploy:__subpackages__",
    ":__subpackages__"
])

ts_project(
    name = "project",
    srcs = glob([ "**/*.ts" ]),
    deps = [],
)

npm_pkg(
    name = "npm_pkg",
    package_name = "do-sync",
    srcs = ["README.md"],
    api_lock = ".api.lock",
    deps_as_jsfiles = [":project_js"],
    entry_point = "lib.ts",
    major_version = "version/MAJOR",
    minor_version = "version/MINOR",
    patch_version = "version/PATCH",
    pkg_json_base = "package.template.json",
    tgz = "do-sync.tgz",
    version_lock = ".version.lock",
    visibility = ["//deploy:__subpackages__"],
    deps = [":project_ts"],
)






