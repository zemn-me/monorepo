load("//:rules.bzl", "ts_declarations")

package(default_visibility = ["//:__subpackages__"])

ts_declarations(
    name = "css_loader",
    srcs = [ "css_loader.d.ts" ]
)

exports_files(["rule.ts"], visibility = ["//:__subpackages__"])



