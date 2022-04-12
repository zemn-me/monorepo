load("//ts:rules.bzl", "ts_project", "ts_test")

package(default_visibility = ["//visibility:public"])

ts_project(
    name = "cultist",
    srcs = ["index.ts"],
    tsconfig = "//:tsconfig_node",
    deps = [
        ":action",
        ":element",
        ":history",
        ":recipe",
        ":state",
        ":types",
        ":verb",
        "@npm//@types/uuid",
        "@npm//immutable",
    ],
)

alias(
    name = "state",
    actual = "//project/cultist/state",
)

alias(
    name = "state_ts",
    actual = "//project/cultist/state:state_ts",
)

ts_project(
    name = "element",
    srcs = ["element.ts"],
    deps = [
        "//project/cultist/state",
        "//ts/iter",
    ],
)

ts_project(
    name = "history",
    srcs = ["history.ts"],
    deps = [":types"],
)

ts_project(
    name = "recipe",
    srcs = ["recipe.ts"],
    deps = [
        ":aspects",
        ":types",
        ":verb",
    ],
)

ts_project(
    name = "save_test_ts",
    srcs = ["save_test.ts"],
    deps = [
        ":save",
        "//project/cultist/example",
    ],
)

ts_test(
    name = "save_test",
    srcs = [":save_test_ts"],
    deps = [":save_test"],
)

ts_project(
    name = "action_test",
    srcs = ["action_test.ts"],
    deps = [
        "element",
        ":action",
        ":state",
    ],
)

ts_test(
    name = "action_test_tests",
    srcs = ["action_test.js"],
    deps = [":action_test"],
)

ts_project(
    name = "slots",
    srcs = ["slots.ts"],
    deps = [
        ":aspects",
        ":types",
    ],
)

ts_project(
    name = "aspects",
    srcs = ["aspects.ts"],
    deps = [":types"],
)

ts_project(
    name = "verb",
    srcs = ["verb.ts"],
    deps = [
        ":slots",
        ":types",
        "//ts",
        "//ts/iter",
    ],
)

ts_project(
    name = "action",
    srcs = ["action.ts"],
    deps = [
        ":types",
        "//project/cultist/state",
    ],
)

ts_project(
    name = "types",
    srcs = ["types.ts"],
)

ts_project(
    name = "save",
    srcs = ["save.ts"],
)
