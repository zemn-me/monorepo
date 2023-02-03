load("//css:providers.bzl", "CSSLibraryInfo", "css_library_info")
load("//css/lint:rules.bzl", "css_lint")
load("//rs/css/module:rules.bzl", "css_module_rule")

def css_module(name, srcs, **kwargs):
    css_module_rule(name = name, srcs = srcs, **kwargs)

def _css_library_impl(ctx):
    css_info = css_library_info(
        srcs = depset(ctx.files.srcs),
        deps = [x[CSSLibraryInfo] for x in ctx.attr.deps if CSSLibraryInfo in x],
    )

    return [
        css_info,
        DefaultInfo(
            files = css_info.deps,
        ),
    ]

_css_library_rule = rule(
    implementation = _css_library_impl,
    attrs = {
        "srcs": attr.label_list(allow_files = True, doc = "A set of CSS files to group in a library."),
        "deps": attr.label_list(allow_files = False, providers = [CSSLibraryInfo], doc = "A set of CSS libraries this group depends on."),
    },
)

def css_library(name = None, srcs = None, deps = None, **kwargs):
    _css_library_rule(
        name = name,
        srcs = srcs,
        deps = deps,
        **kwargs
    )
    css_lint(
        name = name + "_lint",
        srcs = srcs,
        deps = deps,
        **kwargs
    )
