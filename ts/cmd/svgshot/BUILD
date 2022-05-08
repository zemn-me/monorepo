load("//:rules.bzl", "ts_project")

ts_project(
    name = "project",
    srcs = glob(["src/**/*.ts"]),
    deps = [
        "@npm//@types/node",
        "@npm//@types/svgo",
        "@npm//@types/tmp",
        "@npm//commander",
        "@npm//puppeteer",
        "@npm//svgo",
        "@npm//tmp",
    ],
)
