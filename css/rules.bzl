load("//ts:rules.bzl", "ts_project")
load("//css:providers.bzl", "CSSLibraryInfo", "css_library_info")
load("//css/lint:rules.bzl", "css_lint")
load("@build_bazel_rules_nodejs//:providers.bzl", "js_ecma_script_module_info", "JSEcmaScriptModuleInfo", "declaration_info")


def css_module(name = None, srcs = [], **kwargs):
    tsfilerulename = name + "_gen"
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

    typescript_def_outputs = [
        ctx.actions.declare_file(srcFile.basename + ".d.ts", sibling = srcFile)
        for srcFile in ctx.files.srcs
    ]

    for file in typescript_def_outputs:
        ctx.actions.write(
            file,
            "declare module '" + file.basename + "' { export const content: Record<string, string>; export default content }"
        )

    
    ts_info = declaration_info(
        declarations = depset(typescript_def_outputs)
    )

    css_info = css_library_info(
        srcs = depset(ctx.files.srcs),
        deps = [x[CSSLibraryInfo] for x in ctx.attr.deps if CSSLibraryInfo in x],
    )

    # fake provider, technically
    js_info = js_ecma_script_module_info(
        sources = depset(ctx.files.srcs),
        deps = [x[JSEcmaScriptModuleInfo] for x in ctx.attr.deps if JSEcmaScriptModuleInfo in x],
    )

    return [
        css_info,
        ts_info,
        js_info,
        DefaultInfo(
            files = depset(transitive=[css_info.srcs, css_info.deps])
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
