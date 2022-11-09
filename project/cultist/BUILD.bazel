load("//ts:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//visibility:public"])

ts_project(
    name = "cultist",
    srcs = ["index.ts"],
    deps = [
        ":action",
        ":element",
        ":history",
        ":recipe",
        ":types",
        ":verb",
        "//project/cultist/state",
        "@npm//@types/uuid",
        "@npm//immutable",
    ],
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
    name = "save_tests",
    srcs = ["save_test.ts"],
    deps = [
        ":save",
        "//project/cultist/example",
        "@npm//@types/jest",
    ],
)

jest_test(
    name = "save_test",
    srcs = ["save_test.js"],
    deps = [":save_tests"],
)

ts_project(
    name = "action_tests",
    srcs = ["action_test.ts"],
    deps = [
        "element",
        ":action",
        "//project/cultist/state",
        "@npm//@types/jest",
    ],
)

jest_test(
    name = "action_test",
    srcs = ["action_test.js"],
    deps = [
        ":action_tests",
        "@npm//@types/jest",
    ],
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
