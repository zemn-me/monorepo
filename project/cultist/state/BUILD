load("//:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//visibility:public"])

ts_project(
    name = "state",
    srcs = ["index.ts"],
    project_deps = [
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
    project_deps = [
        "//project/cultist:save",
        "//ts/iter:iter",
        "//ts:ts",
        ":state_main",
    ],
    deps = ["@npm//immutable"],
)

ts_project(
    name = "serialize",
    srcs = ["serialize.ts"],
    project_deps = [
        "//ts:ts",
        "//project/cultist:save",
        ":state_main",
        "//ts/iter:iter",
    ],
)

ts_project(
    name = "op",
    srcs = ["op.ts"],
    project_deps = [":state_main"],
    deps = [
        "@npm//@types/uuid",
        "@npm//immutable",
        "@npm//uuid",
    ],
)

ts_project(
    name = "state_test",
    srcs = ["state_test.ts"],
    project_deps = [
        ":state_main",
        "//project/cultist:save",
        ":serialize",
        "//ts:ts",
        ":deserialize",
    ],
    deps = ["@npm//@types/jest"],
)

jest_test(
    name = "test",
    srcs = ["state_test.js"],
    project_deps = [":state_test"],
)
