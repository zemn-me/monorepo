load("//ts:rules.bzl", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "oauth2",
    srcs = glob([
        "**/*.ts",
        "**/*.tsx",
        "**/*.json",
        "**/*.js",
        "**/*.jsx",
    ]),
    resolve_json_module = True,
    deps = [
        "@npm//@types/react",
        "@npm//react",
        "@npm//react-storage-hooks",
        "@npm//immutable",
        "@npm//@types/jest"
    ],
)
