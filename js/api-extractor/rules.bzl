"""Rules for producing a stable report and declaration rollup with API Extractor."""

def _api_extractor_impl(ctx):
    config = ctx.actions.declare_file(ctx.label.name + ".json")
    report = ctx.outputs.report
    extractor_report = ctx.actions.declare_file(ctx.label.name + ".api.md")
    rollup = ctx.outputs.public_trimmed_rollup

    # The generated config lives under bazel-out/.../bin/<package>. Walking
    # back one segment per package component reaches the Bazel bin root.
    project_folder = "/".join(
        [".."] * len(ctx.label.package.split("/")),
    )
    entry_point = "<projectFolder>/" + ctx.file.entry_point.short_path
    extractor_report_folder = extractor_report.short_path[
        :extractor_report.short_path.rfind("/")
    ]

    ctx.actions.write(
        output = config,
        content = json.encode_indent({
            "apiReport": {
                "enabled": True,
                # API Extractor requires report filenames to end in `.api.md`.
                # Keep that tool-specific convention private so callers can
                # retain stable Bazel output names.
                "reportFileName": extractor_report.basename,
                "reportFolder": "<projectFolder>/" + extractor_report_folder,
            },
            "compiler": {
                "overrideTsconfig": {
                    "compilerOptions": {
                        "module": "Node16",
                        "moduleResolution": "Node16",
                        "skipLibCheck": True,
                        "strict": True,
                    },
                },
            },
            "docModel": {
                "enabled": False,
            },
            "dtsRollup": {
                "enabled": True,
                "publicTrimmedFilePath": "<projectFolder>/" + rollup.short_path,
            },
            "mainEntryPointFilePath": entry_point,
            "projectFolder": project_folder,
            "tsdocMetadata": {
                "enabled": False,
            },
        }),
    )

    ctx.actions.run(
        executable = ctx.executable._api_extractor,
        arguments = [
            "run",
            "--local",
            "--config",
            config.short_path,
        ],
        inputs = depset(
            direct = [
                config,
                ctx.file.entry_point,
                ctx.file.package_json,
                ctx.file.tsconfig,
            ],
            transitive = [depset(ctx.files.srcs)],
        ),
        outputs = [extractor_report, rollup],
        mnemonic = "APIExtractor",
        progress_message = "Extracting the public TypeScript API for %{label}",
        env = {
            "BAZEL_BINDIR": ctx.var["BINDIR"],
        },
    )

    ctx.actions.symlink(
        output = report,
        target_file = extractor_report,
    )

    return [DefaultInfo(files = depset([report, rollup]))]

_api_extractor = rule(
    implementation = _api_extractor_impl,
    attrs = {
        "entry_point": attr.label(allow_single_file = [".d.ts"], mandatory = True),
        "package_json": attr.label(
            allow_single_file = [".json"],
            default = "//:package_json",
        ),
        "public_trimmed_rollup": attr.output(mandatory = True),
        "report": attr.output(mandatory = True),
        "srcs": attr.label_list(allow_files = True),
        "tsconfig": attr.label(
            allow_single_file = [".json"],
            default = "//:tsconfig",
        ),
        "_api_extractor": attr.label(
            cfg = "exec",
            default = "//js/api-extractor:api_extractor",
            executable = True,
        ),
    },
)

def api_extractor(name, **kwargs):
    _api_extractor(name = name, **kwargs)
