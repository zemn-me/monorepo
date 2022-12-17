load("@npm//next:index.bzl", "next")
load("//git:rules.bzl",  "commit_affecting_rule")
load("//ts:rules.bzl", "ts_project")
load("@bazel_skylib//rules:copy_file.bzl", "copy_file")


# Because next.js is whiny, it refuses to compile CSS modules
# if they're in node_modules; but rules_nodejs uses node_modules
# for file and module resolution.
# Hence, we build a somewhat fake tree under the next.js root
# to make it think that our other modules were all part of that
#  same big next.js project all along.
def _link_node_deps_impl(ctx):

    all_files = [file for file in depset(
        transitive = ([
            src[DefaultInfo].files for src in ctx.attr.srcs
            if DefaultInfo in src and src[DefaultInfo].files != None
        ] + [
            src[DefaultInfo].default_runfiles.files for src in ctx.attr.srcs
            if DefaultInfo in src and src[DefaultInfo].default_runfiles != None
        ])
    ).to_list()
    if
        # i think this bazel convention is insane, but i cant complain
        file.owner.workspace_name == ctx.workspace_name or
        file.owner.workspace_name == ""
    ]


    output_files = [
        ctx.actions.declare_directory(
            # next_project/monorepo/path/to/some/dep
            ctx.workspace_name + "/" + file.short_path,
        )
        if file.is_directory else 
        ctx.actions.declare_file(
            # next_project/monorepo/path/to/some/dep
            ctx.workspace_name + "/" + file.short_path,
        )

        for file in all_files
    ]



    for dest, source in zip(output_files, all_files):
        ctx.actions.symlink(
            output = dest,
            target_file = source,
            progress_message = 
                "Tricking next.js into thinking modules are in the same"+
                 "place by linking "+source.path +
                    " to " + dest.path
        )

    return [
        DefaultInfo(
            files = depset(output_files)
        )
    ]

_link_node_deps = rule(
    implementation = _link_node_deps_impl,
    attrs = {
        "srcs": attr.label_list(mandatory = True),
    },
)

def next_project(name, srcs, **kwargs):
    distDir = "build"
    #target = "node_modules/monorepo/" + native.package_name()
    target = "bazel-out/k8-fastbuild/bin/" + native.package_name()



    native.filegroup(
        name = name + "_git_analysis_srcs",
        srcs = srcs
    )

    commit_affecting_rule(
        name = name + "_latest_commit",
        rule = ":" + name + "_git_analysis_srcs"
    )

    # absolutely horrible engineering here. i'm so sorry.
    native.genrule(
        name = name + "_sed_command",
        outs = [ "buildid.sed" ],
        srcs = [ name + "_latest_commit" ],
        cmd_bash = """
            echo "s|/\\*REPLACE\\*/ throw new Error() /\\*REPLACE\\*/|return \\"$$(cat $(location """
                + name +
            """_latest_commit))\\"|g" >$@
        """,
    )

    # copy the next config over
    native.genrule(
        name = name + "_gen_next.config.ts",
        srcs = ["//ts/next.js:next.config.ts", "buildid.sed"],
        outs = ["next.config.ts"],
        cmd_bash = """
            sed -f $(location buildid.sed) $(location //ts/next.js:next.config.ts) >$@
        """,
    )

    ts_project(
        name = name + "_next_config",
        srcs = ["next.config.ts"],
    )

    srcs = srcs + [":" + name + "_next_config"]




    _link_node_deps(
        name = name + "_symlinked_fake_deps",
        srcs = srcs
    )

    srcs_with_trick = [ name + "_symlinked_fake_deps"] + srcs

    next(
        name = name + ".dev",
        data = srcs_with_trick,
        link_workspace_root = True,
        args = ["dev", target],
    )

    next(
        name = distDir,
        data = srcs_with_trick,
        link_workspace_root = True,
        args = ["build", target],
        output_dir = True,
        silent_on_success = True,
    )

    next(
        name = "out",
        data = [":build"] + srcs_with_trick,
        args = ["export", target],
        link_workspace_root = True,
        output_dir = True,
        silent_on_success = True,
    )

    native.alias(
        name = name,
        actual = "out",
    )
