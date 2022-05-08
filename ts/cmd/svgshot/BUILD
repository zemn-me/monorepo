load("//:rules.bzl", "ts_project")

ts_project(
    name = "project",
    srcs = glob([ "src/**/*.ts" ]),
    deps = [
        "@npm//puppeteer",
        "@npm//@types/node",
        "@npm//svgo",
        "@npm//tmp",
        "@npm//@types/tmp",
        "@npm//@types/svgo",
        "@npm//commander"
    ]
)