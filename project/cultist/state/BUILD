load("//ts:rules.bzl", "ts_project", "ts_test")

package(default_visibility = ["//visibility:public"])

ts_project(
    name = "state",
    srcs = ["index.ts"],
    deps = [
        ":deserialize",
        ":op",
        ":serialize",
        ":state_main",
    ],
)

ts_project(
    name = "state_main",
    srcs = ["state.ts"],
    deps = ["@npm//immutable"],
)

ts_project(
    name = "deserialize",
    srcs = ["deserialize.ts"],
    deps = [
        ":state_main",
        "//project/cultist:save",
        "//ts",
        "//ts/iter",
        "@npm//immutable",
    ],
)

ts_project(
    name = "serialize",
    srcs = ["serialize.ts"],
    deps = [
        ":state_main",
        "//project/cultist:save",
        "//ts",
        "//ts/iter",
    ],
)

ts_project(
    name = "op",
    srcs = ["op.ts"],
    deps = [
        ":state_main",
        "@npm//@types/uuid",
        "@npm//immutable",
        "@npm//uuid",
    ],
)

ts_project(
    name = "state_test",
    srcs = ["state_test.ts"],
    deps = [
        ":deserialize",
        ":serialize",
        "//project/cultist:save",
        "//ts",
    ],
)

ts_test(
    name = "test",
    srcs = ["state_test.js"],
    deps = [":state_test"],
)
