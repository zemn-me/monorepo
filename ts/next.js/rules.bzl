def _provision_runfiles_impl(ctx):
    # bootstraps next.js compilation
    # by creating a set of runfiles containing what's needed
    # at build time.
    #
    # This is necessary because next.js doesn't let you
    # configure file locations very much.

    config = {
        "distDir": ctx.attr.out_dir,
        "typescript": {
            "tsconfigPath": ctx.file.tsconfig.path
        }
    }

    ctx.actions.write(
        output = ctx.outputs.executable,
        is_executable = True,
        content = "#! /usr/bin/env bash\n./"
            + ctx.executable.next_js_binary.path
            + " $@"
    )

    ctx.actions.write(
        output = ctx.outputs.config,
        content = json.encode_indent(config)
    )

    runfiles = ctx.runfiles(
        files = [
            ctx.file.tsconfig,
            ctx.outputs.config,
            ctx.executable.next_js_binary
        ] + ctx.files.deps + ctx.files.srcs
    )

    return [
        DefaultInfo(files = depset([ctx.outputs.executable]),
        runfiles=runfiles, executable = ctx.outputs.executable)
    ]
_provision_runfiles = rule(
    implementation = _provision_runfiles_impl,
    attrs = {
        "next_js_binary": attr.label(mandatory = True, executable = True, cfg = "target"),
        "srcs": attr.label_list(allow_files = True),
        "deps": attr.label_list(),
        "tsconfig": attr.label(allow_single_file = True),
        "out_dir": attr.string(),
        "config": attr.output(),
        "executable": attr.output()
    }
)


def _next_js_impl(ctx):

    out_dir = ctx.actions.declare_directory(
        ctx.attr.out_dir
    )


    ctx.actions.run (
        outputs = [ out_dir ],
        inputs = [],
        executable = ctx.executable.next_binary,
        mnemonic = "NextJS",
        progress_message = "Running nextjs build",
        arguments = [ ctx.attr.base_dir ]
    )


    return [
        DefaultInfo(
            files = depset([out_dir]),
        ),
    ]


_next_js_rule = rule(
    implementation = _next_js_impl,
    attrs = {
        "next_binary": attr.label(mandatory = True, executable = True, cfg = "target"),
        "srcs": attr.label_list(allow_files = True),
        "deps": attr.label_list(),
        "base_dir": attr.string(mandatory = True),
        "out_dir": attr.string(mandatory = True),
    }
)


def next_js(name, **kwargs):
    _provision_runfiles(
        name = name + "_run",
        next_js_binary = "@npm//next/bin:next",
        tsconfig = "//:tsconfig",
        config = "next.config.json",
        executable = "provisioned_node_js.sh"
    )

    _next_js_rule(
        base_dir = native.package_name(),
        name = name,
        next_binary = ":" +name+"_run",
        out_dir = name + "_out",
        **kwargs
    )

