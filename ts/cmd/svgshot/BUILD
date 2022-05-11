load("//:rules.bzl", "nodejs_binary", "ts_project", "jest_test")

ts_project(
    name = "project",
    srcs = [
        "index.ts",
        "lib.ts",
        "svgshot_test.ts"
    ],
    deps = [
        "@npm//@types/node",
        "@npm//@types/svgo",
        "@npm//@types/tmp",
        "@npm//@types/jest",
        "@npm//commander",
        "@npm//puppeteer",
        "@npm//svgo",
        "@npm//tmp",
    ],
)

nodejs_binary(
    name = "svgshot",
    args = [
        "--inkscapeBin",
        "$(location //cc/inkscape:bin)",
    ],
    data = [
        ":project_ts",
    ],
    entry_point = "index.ts",
)

jest_test(
    name = "tests",
    srcs = [ "svgshot_test.js" ],
    project_deps = [ ":project" ],
    data = [
        "//cc/inkscape:bin",
    ],
    env = {
        "INKSCAPE_BIN": "$(location //cc/inkscape:bin)",
    },
)