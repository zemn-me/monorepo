load("@npm//@bazel/esbuild:index.bzl", "esbuild")
load("@npm//http-server:index.bzl", "http_server")

def web_app(name, entry_points, esbuild_deps = [], deps = [], **kwargs):
    native.filegroup(
        name = name + "_deps",
        srcs = deps
    )

    esbuild(
        name = name + "_prod_build",
        entry_points = entry_points,
        minify = True,
        output_dir = "es_out",
        splitting = True,
        target = "chrome58",
        deps = esbuild_deps,
        metafile = False,
    )
    
    esbuild(
        metafile = False,
        sources_content = True,
        name = name + "_dev_build",
        entry_points = entry_points,
        minify = False,
        splitting = True,
        target = "chrome58",
        deps = esbuild_deps
    )

    native.genrule(
        name = name + "_dev_bundle",
        srcs = [ ":" + name + "_dev_build", ":" + name + "_deps" ],
        outs = [ "root_dev" ],
        cmd = "mkdir $@; cp $(location :"+name+"_dev_build)/* $@;"+
            "cp $(rootpaths :"+name+"_deps) $@"
    )

    native.genrule(
        name = name + "_prod_bundle",
        srcs = [ ":" + name + "_prod_build", ":" + name + "_deps" ],
        outs = [ "root_prod" ],
        cmd = "mkdir $@; cp $(location :"+name+"_prod_build)/* $@;"+
            "cp $(rootpaths :"+name+"_deps) $@"
    )

    native.alias(
        name = name,
        actual = ":" + name + "_prod_bundle"
    )
    
    native.alias(
        name = name + "_dev",
        actual = ":" + name + "_dev_bundle"
    )

    http_server(
        name = name + "_run",
        data = [ ":"+name + "_dev_bundle" ],
        args = [ "$(location :" + name + "_dev_bundle)" ]
    )

    http_server(
        name = name + "_prod_run",
        data = [ ":"+name + "_prod_bundle" ],
        args = [ "$(location :" + name + "_prod_bundle)" ]
    )

