"""API for declaring a Biome lint aspect."""

load("@aspect_rules_lint//lint/private:lint_aspect.bzl", "LintOptionsInfo", "OUTFILE_FORMAT", "filter_srcs", "noop_lint_action", "output_files", "patch_and_output_files", "should_visit")

_MNEMONIC = "AspectRulesLintBiome"

def _biome_action(ctx, executable, srcs, config, extra_inputs, stdout, exit_code = None, reporter = None, env = {}):
    outputs = [stdout]
    args = ctx.actions.args()
    args.add("lint")
    args.add("--config-path", config)
    args.add("--no-errors-on-unmatched")
    if reporter:
        args.add("--reporter", reporter)
    args.add_all(srcs)

    if exit_code:
        outputs.append(exit_code)
        command = "{biome} $@ > {stdout} 2>&1; echo $? > {exit_code}".format(
            biome = executable.path,
            exit_code = exit_code.path,
            stdout = stdout.path,
        )
    else:
        command = "{biome} $@ > {stdout} 2>&1".format(
            biome = executable.path,
            stdout = stdout.path,
        )

    ctx.actions.run_shell(
        inputs = srcs + [config] + extra_inputs,
        outputs = outputs,
        command = command,
        arguments = [args],
        mnemonic = _MNEMONIC,
        env = dict(env, **{
            "BAZEL_BINDIR": ".",
        }),
        progress_message = "Linting %{label} with Biome",
        tools = [executable],
    )

def _biome_fix(ctx, executable, srcs, config, extra_inputs, patch, stdout, exit_code, env = {}):
    patch_cfg = ctx.actions.declare_file("_{}.patch_cfg".format(ctx.label.name))

    ctx.actions.write(
        output = patch_cfg,
        content = json.encode({
            "linter": executable.path,
            "args": ["lint", "--write", "--config-path", config.path, "--no-errors-on-unmatched"] + [s.path for s in srcs],
            "env": dict(env, **{
                "BAZEL_BINDIR": ".",
            }),
            "files_to_diff": [s.path for s in srcs],
            "output": patch.path,
        }),
    )

    ctx.actions.run(
        inputs = srcs + [config, patch_cfg] + extra_inputs,
        outputs = [patch, stdout, exit_code],
        executable = ctx.executable._patcher,
        arguments = [patch_cfg.path],
        env = dict(env, **{
            "BAZEL_BINDIR": ".",
            "JS_BINARY__EXIT_CODE_OUTPUT_FILE": exit_code.path,
            "JS_BINARY__STDOUT_OUTPUT_FILE": stdout.path,
            "JS_BINARY__SILENT_ON_SUCCESS": "1",
        }),
        mnemonic = _MNEMONIC,
        progress_message = "Fixing %{label} with Biome",
        tools = [executable],
    )

def _biome_aspect_impl(target, ctx):
    if not should_visit(ctx.rule, ctx.attr._rule_kinds):
        return []

    files_to_lint = filter_srcs(ctx.rule)
    if ctx.attr._options[LintOptionsInfo].fix:
        outputs, info = patch_and_output_files(_MNEMONIC, target, ctx)
    else:
        outputs, info = output_files(_MNEMONIC, target, ctx)

    if len(files_to_lint) == 0:
        noop_lint_action(ctx, outputs)
        return [info]

    color_env = {"FORCE_COLOR": "1"} if ctx.attr._options[LintOptionsInfo].color else {}

    if hasattr(outputs, "patch"):
        _biome_fix(ctx, ctx.executable._biome, files_to_lint, ctx.file._config_file, ctx.files._extra_config_files, outputs.patch, outputs.human.out, outputs.human.exit_code, env = color_env)
    else:
        _biome_action(ctx, ctx.executable._biome, files_to_lint, ctx.file._config_file, ctx.files._extra_config_files, outputs.human.out, outputs.human.exit_code, env = color_env)

    raw_machine_report = ctx.actions.declare_file(OUTFILE_FORMAT.format(label = target.label.name, mnemonic = _MNEMONIC, suffix = "raw_machine_report"))
    _biome_action(ctx, ctx.executable._biome, files_to_lint, ctx.file._config_file, ctx.files._extra_config_files, raw_machine_report, outputs.machine.exit_code, reporter = "sarif")
    ctx.actions.symlink(output = outputs.machine.out, target_file = raw_machine_report)

    return [info]

def lint_biome_aspect(binary, config, extra_configs = [], rule_kinds = ["js_library", "ts_project", "ts_project_rule"]):
    """Create a Biome linter aspect."""

    if type(extra_configs) == "string":
        extra_configs = [extra_configs]

    return aspect(
        implementation = _biome_aspect_impl,
        attrs = {
            "_options": attr.label(
                default = "@aspect_rules_lint//lint:options",
                providers = [LintOptionsInfo],
            ),
            "_biome": attr.label(
                default = binary,
                executable = True,
                cfg = "exec",
            ),
            "_config_file": attr.label(
                default = config,
                allow_single_file = True,
            ),
            "_extra_config_files": attr.label_list(
                default = extra_configs,
                allow_files = True,
            ),
            "_patcher": attr.label(
                default = "@aspect_rules_lint//lint/private:patcher",
                executable = True,
                cfg = "exec",
            ),
            "_rule_kinds": attr.string_list(
                default = rule_kinds,
            ),
        },
    )
