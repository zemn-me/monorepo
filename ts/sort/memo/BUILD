load("//:rules.bzl", "jest_test", "ts_project")

tstestfiles = glob(["*_test.ts"])

ts_project(
    name = "memo",
    srcs = glob(
        include = ["*.ts"],
        exclude = ["*_test.ts"],
    ),
    composite = True,
    declaration = True,
    incremental = True,
    project_deps = [ "//ts/iter:iter" ],
    deps = [
        "@npm//immutable",
    ]
)

ts_project(
    name = "tests_lib",
    srcs = tstestfiles,
    composite = True,
    declaration = True,
    incremental = True,
    project_deps = [":memo"],
    tsconfig = "//:tsconfig_node",
    deps = [
        "@npm//@types/jest",
    ],
)

jest_test(
    name = "test",
    srcs = [f[:-len(".ts")] + ".js" for f in tstestfiles],
    deps = [
        ":memo_js",
    ],
)