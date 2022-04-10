load("//ts:rules.bzl", "ts_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name ="srcs",
    srcs = glob([ ".ts", "*.tsx" ]),
    deps = [
        "@npm//ts-toolbelt",
    ]
)

ts_test(
    name = "test",
    srcs = [ ":time" ]
)
