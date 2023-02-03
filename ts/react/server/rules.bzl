load("@npm//@bazel/esbuild:index.bzl", "esbuild")
load("@npm//http-server:index.bzl", "http_server")
load("//css:providers.bzl", "css_library_info")

def _get_css_aspect(target, ctx):
    if not hasattr(ctx.rule.attr, "srcs"):
        return []
    if not hasattr(ctx.rule.attr, "deps"):
        return []

    csslibinfo = css_library_info(
        srcs = depset([css_file for css_file in ctx.rule.files.srcs if css_file.extension == "css"]),
        deps = ctx.rule.attr.deps,
    )

    return [
        csslibinfo,
        OutputGroupInfo(all_files = csslibinfo.deps),
    ]

get_css_aspect = aspect(
    implementation = _get_css_aspect,
    attr_aspects = ["deps"],
    doc = """
        For a given rule, collects any css files in deps or sources.
    """,
)

def _get_css_rule(ctx):
    cssinfo = css_library_info(depset([
        file
        for file in ctx.files.srcs
        if file.extension == "css"
    ]), deps = ctx.attr.deps)

    return [
        cssinfo,
        # https://github.com/bazelbuild/rules_nodejs/blob/stable/packages/esbuild/esbuild.bzl
        DefaultInfo(files = cssinfo.deps, data_runfiles = ctx.runfiles(files = cssinfo.deps.to_list())),
    ]

get_css_rule = rule(
    implementation = _get_css_rule,
    attrs = {
        "srcs": attr.label_list(),
        "deps": attr.label_list(aspects = [get_css_aspect]),
    },
)

def web_app(name, entry_points, srcs = [], tsconfig = "//:tsconfig", esbuild_deps = [], deps = ["//ts/react/server:index.html"], visibility = [], **kwargs):
    deps.append("//:tsconfig.json")
    native.filegroup(
        name = name + "_deps",
        srcs = deps,
    )

    get_css_rule(
        name = name + "_css",
        srcs = srcs,
        deps = esbuild_deps,
    )

    # make sure to include any extracted CSS files
    esbuild_deps = esbuild_deps + [":" + name + "_css"]

    esbuild(
        srcs = ["//:tsconfig.json"],
        name = name + "_prod_build",
        entry_points = entry_points,
        minify = True,
        output_dir = "es_out",
        config = "//:esbuild_config",
        splitting = True,
        target = "chrome58",
        sources_content = True,
        deps = esbuild_deps,
        visibility = visibility,
        metafile = False,
        link_workspace_root = True,
    )

    esbuild(
        srcs = ["//:tsconfig.json"],
        metafile = False,
        sources_content = True,
        name = name + "_dev_build",
        entry_points = entry_points,
        config = "//:esbuild_config",
        link_workspace_root = True,
        minify = False,
        splitting = True,
        visibility = visibility,
        target = "chrome58",
        deps = esbuild_deps,
    )

    native.genrule(
        name = name + "_dev_bundle",
        srcs = [":" + name + "_dev_build", ":" + name + "_deps"],
        outs = ["root_dev"],
        visibility = visibility,
        cmd = "mkdir $@; cp $(location :" + name + "_dev_build)/* $@;" +
              "cp $(rootpaths :" + name + "_deps) $@",
    )

    native.genrule(
        name = name + "_prod_bundle",
        srcs = [":" + name + "_prod_build", ":" + name + "_deps"],
        outs = ["root_prod"],
        visibility = visibility,
        cmd = "mkdir $@; cp $(location :" + name + "_prod_build)/* $@;" +
              "cp $(rootpaths :" + name + "_deps) $@",
    )

    native.alias(
        name = name,
        visibility = visibility,
        actual = ":" + name + "_prod_bundle",
    )

    native.alias(
        name = name + "_dev",
        visibility = visibility,
        actual = ":" + name + "_dev_bundle",
    )

    http_server(
        name = name + "_run",
        data = [":" + name + "_dev_bundle"],
        visibility = visibility,
        args = ["--proxy", "http://localhost:8080?", "$(location :" + name + "_dev_bundle)"],
    )

    http_server(
        name = name + "_prod_run",
        data = [":" + name + "_prod_bundle"],
        visibility = visibility,
        args = ["--proxy", "http://localhost:8080?", "$(location :" + name + "_prod_bundle)"],
    )
