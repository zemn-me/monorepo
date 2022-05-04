load("//:rules.bzl", "ts_project", "nodejs_binary")
package(default_visibility = ["//deploy:__subpackages__"])

# This is a list of build tags which will be uploaded to a github release.
BUILD_ARTIFACTS = { 
    "recursive_vassals.zip": "//project/ck3/recursive-vassals:mod_zip",
    "recursive_vassals.patch": "//project/ck3/recursive-vassals:patch"
}

ts_project(
    name = "release_src",
    srcs = [ "release.ts" ],
    deps = [
        "@npm//@actions/github",
        "@npm//@types/node"
    ]
)

nodejs_binary(
    name = "release",
    entry_point = "release.js",
    data = BUILD_ARTIFACTS.values(),
    templated_args = [ name + "=" + tag for (name, tag) in BUILD_ARTIFACTS.items() ]
)

