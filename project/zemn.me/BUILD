
load("//:rules.bzl", "ts_project")
load("//ts/react/server:rules.bzl", "web_app")

ts_project(
    name = "ts",
    srcs = glob(["*.ts", "*.tsx", "*.module.css"]),
    entry_points = glob(["*.ts", "*.tsx"]),
    deps = [
        "@npm//@types/react",
        "@npm//@types/react-dom",
        "@npm//react",
        "@npm//react-dom",
    ]
)

web_app(
    name = "zemn.me",
    entry_points = [ "index.tsx" ],
    esbuild_deps = [ ":ts_ts" ],
    deps = [ "index.html", "root.module.scss" ]
)