load("//ts:rules.bzl", "ts_project")
load("//:rules.bzl", "jest_test")

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
        "//project/cultist:save",
        "//ts/iter:iter",
        "//ts:ts",
        ":state_main",
    "@npm//immutable"],
)

ts_project(
    name = "serialize",
    srcs = ["serialize.ts"],
    deps = [
        "//ts:ts",
        "//project/cultist:save",
        ":state_main",
        "//ts/iter:iter",
    ],
)

ts_project(
    name = "op",
    srcs = ["op.ts"],
    deps = [
        "@npm//@types/uuid",
    ":state_main",
        "@npm//immutable",
        "@npm//uuid",
    ],
)

ts_project(
    name = "state_test",
    srcs = ["state_test.ts"],
    deps = [
        ":state_main",
        "//project/cultist:save",
        ":serialize",
        "//ts:ts",
        ":deserialize",
    "@npm//@types/jest"],
)

jest_test(
    name = "test",
    srcs = ["state_test.js"],
    deps = [":state_test"],
)
