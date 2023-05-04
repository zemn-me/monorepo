def _copy_to_local_impl(ctx):
    # Get the input filegroup
    inputs = depset(transitive =[src.files for src in ctx.attr.srcs]).to_list()

    # Get the output directory
    output_dir = ctx.attr.out_dir
    
    output_files = [ctx.actions.declare_file(
        output_dir + "/" + input_file.path
    ) for input_file in inputs]



    for input_file, output_file in zip(inputs, output_files):
        ctx.actions.run_shell(
            outputs = [ output_file ],
            inputs = [ input_file ],
            arguments = [ input_file.path, output_file.path ],
            command = "cp $1 $2",
            progress_message = "%{label}: cp %{input} %{output}"
        )

    return [
        DefaultInfo(
            files = depset(output_files)
        )
    ]


copy_to_local = rule(
    implementation = _copy_to_local_impl,
    attrs = {
        "srcs": attr.label_list(allow_files = True),
        "out_dir": attr.string(),
    },
)