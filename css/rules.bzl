load("//:rules.bzl", "ts_project")
load("//css:providers.bzl", "css_library_info", "CSSLibraryInfo")
load("//css/lint:rules.bzl", "css_lint")


def css_module(name = None, srcs = [], **kwargs):
    tsfilerulename = name + "_gen_ts"
    outputtsfiles = [x + ".ts" for x in srcs]
    native.genrule(
        name = tsfilerulename,
        outs = outputtsfiles,
        srcs = ["//css:rule.ts"],
        cmd = """
            cat $< | tee $@
        """,
        message = "Generating typescript declaration files for " +
                  " ".join(srcs),
    )

    ts_project(
        name = name,
        srcs = outputtsfiles + srcs,
        ignores_lint = srcs,
    )



def _css_library_impl(ctx):
    css_info = css_library_info(
            srcs = depset(ctx.files.srcs),
            deps = [ x[CSSLibraryInfo] for x in ctx.attr.deps if CSSLibraryInfo in x]
    )
        
    return [
        css_info,

        DefaultInfo(
            files = css_info.deps
        )
    ]

_css_library_rule = rule(
    implementation = _css_library_impl,
    attrs = {
        "srcs": attr.label_list(allow_files = True, doc = "A set of CSS files to group in a library."),
        "deps": attr.label_list(allow_files = False, providers = [ CSSLibraryInfo ], doc = "A set of CSS libraries this group depends on.")
    }
)

def css_library(name = None, srcs = None, deps = None, **kwargs):
    _css_library_rule(
        name = name,
        srcs = srcs, deps = deps, **kwargs
    )
    css_lint(
        name = name + "_lint",
        srcs = srcs, deps = deps, **kwargs)