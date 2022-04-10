load("//ts:rules.bzl", "ts_project", "ts_test")

package(default_visibility = ["//visibility:public"])

ts_project(
    name = "cultist",
    srcs = ["index.ts"],
    project_deps = [
        ":action",
        ":types",
        ":verb",
        ":history",
        ":recipe",
        ":element",
        ":state",
    ],
    tsconfig = "//:tsconfig_node",
    deps = [
        "@npm//@types/uuid",
        "@npm//immutable",
    ],
)

alias(
    name = "state_js",
    actual = "//project/cultist/state:state_js",
)

alias(
    name = "state_ts",
    actual = "//project/cultist/state:state_ts",
)

alias(
    name = "state_sources",
    actual = "//project/cultist/state:state_sources",
)

ts_project(
    name = "element",
    srcs = ["element.ts"],
    project_deps = [
        ":state",
        "//ts/iter:iter",
    ],
)

ts_project(
    name = "history",
    srcs = ["history.ts"],
    project_deps = [":types"],
)

ts_project(
    name = "recipe",
    srcs = ["recipe.ts"],
    project_deps = [
        ":types",
        ":aspects",
        ":verb",
    ],
)

ts_project(
    name = "save_test",
    srcs = ["save_test.ts"],
    project_deps = [
        "//project/cultist/example:example",
        ":save",
    ],
    deps = ["@npm//@types/jest"],
)

ts_test(
    name = "save_test",
    srcs = ["save_test.js"],
    project_deps = [":save_test"],
)

ts_project(
    name = "action_test",
    srcs = ["action_test.ts"],
    project_deps = [
        ":state",
        ":action",
        "element",
    ],
    deps = ["@npm//@types/jest"],
)

ts_test(
    name = "action_test",
    srcs = ["action_test.js"],
    project_deps = [":action_test"],
    deps = ["@npm//@types/jest"],
)

ts_project(
    name = "slots",
    srcs = ["slots.ts"],
    project_deps = [
        ":types",
        ":aspects",
    ],
)

ts_project(
    name = "aspects",
    srcs = ["aspects.ts"],
    project_deps = [":types"],
)

ts_project(
    name = "verb",
    srcs = ["verb.ts"],
    project_deps = [
        ":types",
        ":slots",
        "//ts/iter:iter",
        "//ts:ts",
    ],
)

ts_project(
    name = "action",
    srcs = ["action.ts"],
    project_deps = [
        ":state",
        ":types",
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
