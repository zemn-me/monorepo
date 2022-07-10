load("@npm//@bazel/esbuild:index.bzl", "esbuild")
load("@npm//http-server:index.bzl", "http_server")

def web_app(name, entry_points, tsconfig = "//:tsconfig", esbuild_deps = [], deps = ["//ts/react/server:index.html"], visibility = [], **kwargs):
    deps += [ tsconfig ]
    native.filegroup(
        name = name + "_deps",
        srcs = deps,
    )

    esbuild(
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
