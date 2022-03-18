
load("//:rules.bzl", "ts_project")
load("//ts/react/server:rules.bzl", "web_app")
load("@npm//http-server:index.bzl", "http_server")

ts_project(
    name = "ts",
    srcs = glob(["*.ts", "*.tsx", "*.css"]),
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
    esbuild_deps = [ ":ts_sources", "@npm//:node_modules" ],
    deps = [ "index.html" ]
)

http_server(
    name = "xxx",
    data = [ "@npm//react:react__all_files", "@npm//react-dom:react-dom__all_files" ] + glob(["*ts", "*.tsx", "*.css"]),
    args = [ "." ]
)