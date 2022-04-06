load("//ts:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_sources(
    name = "srcs",
    srcs = glob([ "*.ts", "*.tsx", "*.css"])
)

ts_project(
    name = "loading",
    srcs = [ ":srcs" ]
)

