load("//:rules.bzl", "jest_test", "ts_config", "ts_project")

package(default_visibility = ["//visibility:public"])

tsfiles = glob(
    ["*.ts"],
    exclude = ["*_test.ts"],
)

tstestfiles = glob(["*_test.ts"])

ts_project(
    name = "cultist",
    srcs = tsfiles,
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_node",
    project_deps = [
        "//cultist/example:example",
        "//typescript:typescript",
        "//typescript/iter:iter"
    ],
    deps = [
        "@npm//@types/uuid",
        "@npm//immutable",
    ],
)

ts_project(
    name = "tests",
    srcs = tstestfiles,
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_node",
    project_deps = [ ":cultist" ],
    deps = [
        "@npm//@types/jest",
    ],
)

jest_test(
    name = "test",
    srcs = [f[:-len(".ts")] + ".js" for f in tstestfiles],
    project_deps = [
        ":tests"
    ],
    deps = [
        "@npm//immutable",
        "@npm//uuid",
    ],
)
