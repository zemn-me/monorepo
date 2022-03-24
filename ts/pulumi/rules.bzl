def pulumi_exec(name, config_files = [], data = [], args = [], env = {}, **kwargs):
    myEnv = {
        "PULUMI_BIN": "$(location @pulumi_cli//:pulumi/pulumi)",
        "ENTRY_POINTS": " ".join(["$(rootpath " + x + ")" for x in config_files]),
        "ARGS": " ".join(args),
    }
    myEnv.update(env)
    native.genrule(
        name = name + "_gen_sh",
        srcs = ["//ts/pulumi:pulumi.sh", "//ts/pulumi:pulumi_header.sh"] + config_files + data + ["@pulumi_cli//:pulumi/pulumi"],
        outs = [name + ".sh"],
        cmd_bash = """
        cat $(location //ts/pulumi:pulumi_header.sh) >$@;
        echo '
        """ +
                   "\n" + "\n".join(["export " + k + "=\"" + v + "\"" for k, v in myEnv.items()]) + "\n" +
                   """
        ' >> $@
        cat $(location //ts/pulumi:pulumi.sh) >> $@
        """,
    )

    native.sh_binary(
        name = name,
        data = ["@pulumi_cli//:pulumi/pulumi"] + data + config_files,
        srcs = [name + "_gen_sh"],
        deps = ["@bazel_tools//tools/bash/runfiles"],
        **kwargs
    )

def pulumi_stack(name, stack_file, stack_name, config_files = [], data = [], args = [], **kwargs):
    pulumi_exec(
        name = name,
        args = args + ["-s", stack_name],
        data = data,
        config_files = config_files + [stack_file],
        **kwargs
    )

def pulumi(name, config_files = [], data = [], stacks = [], **kwargs):
    for stack in stacks:
        stack_name = stack[len("Pulumi."):-len(".yaml")]
        pulumi_stack(
            name = name + "_" + stack_name,
            stack_file = stack,
            stack_name = stack_name,
            config_files = config_files,
            data = data,
            **kwargs
        )
