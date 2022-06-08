load("@build_bazel_rules_nodejs//nodejs:providers.bzl", "DeclarationInfo", "declaration_info")


def _api_extractor_raw_impl(ctx):
    output_files = []
    args = []

    tsdocMetadata = {
        "enabled": False,
    }

    if ctx.attr.tsdocMetadata != None:
        tsdocMetadata["enabled"] = True
        tsdocMetadata["tsdocMetadataFilePath"] = "<projectFolder>/" + ctx.outputs.tsdocMetadata.path
        output_files = output_files + [ctx.outputs.tsdocMetadata]

    dtsRollup = {
        "enabled": False,
    }

    if ctx.attr.untrimmedRollup != None:
        dtsRollup["enabled"] = True
        dtsRollup["untrimmedFilePath"] = "<projectFolder>/" + ctx.outputs.untrimmedRollup.path
        output_files = output_files + [ctx.outputs.untrimmedRollup]

    if ctx.attr.alphaTrimmedRollup != None:
        dtsRollup["enabled"] = True
        dtsRollup["alphaTrimmedFilePath"] = "<projectFolder>/" + ctx.outputs.alphaTrimmedRollup.path
        output_files = output_files + [ctx.outputs.alphaTrimmedRollup]

    if ctx.attr.betaTrimmedRollup != None:
        dtsRollup["enabled"] = True
        dtsRollup["betaTrimmedFilePath"] = "<projectFolder>/" + ctx.outputs.betaTrimmedRollup.path
        output_files = output_files + [ctx.outputs.betaTrimmedRollup]

    if ctx.attr.publicTrimmedRollup != None:
        dtsRollup["enabled"] = True
        dtsRollup["betaTrimmedFilePath"] = "<projectFolder>/" + ctx.outputs.publicTrimmedRollup.path
        output_files = output_files + [ctx.outputs.publicTrimmedRollup]

    docModel = {
        "enabled": False,
    }

    if ctx.attr.docModel != None:
        docModel["enabled"] = True
        docModel["apiJsonFilePath"] = "<projectFolder>/" + ctx.outputs.docModel.path
        output_files = output_files + [ctx.outputs.docModel]

    apiReport = {
        "enabled": False,
    }

    if ctx.attr.report != None:
        # Will not actually generate unless it thinks it's doing a 'local'
        # build due to intended development flow
        args += ["--local"]
        apiReport["enabled"] = True
        apiReport["reportFileName"] = ctx.outputs.report.basename
        apiReport["reportFolder"] = "<projectFolder>/" + ctx.outputs.report.dirname
        output_files = output_files + [ctx.outputs.report]

    compiler = {}

    compiler["tsconfigFilePath"] = "<projectFolder>/" + ctx.file.ts_config.path

    config = {
        "mainEntryPointFilePath": "<projectFolder>/" + ctx.file.entry_point.path,
        "apiReport": apiReport,
        "compiler": compiler,
        "docModel": docModel,
        "dtsRollup": dtsRollup,
        "projectFolder": "/".join([".." for _ in ctx.attr.package_name.split("/")] + ["..", "..", ".."]),
        "tsdocMetadata": tsdocMetadata,
    }

    ctx.actions.write(
        output = ctx.outputs.config,
        content = json.encode_indent(config),
    )

    inputs = ctx.files.srcs + [ctx.outputs.config, ctx.file.entry_point, ctx.file.ts_config, ctx.file.package_json]
    ctx.actions.run(
        outputs = output_files,
        inputs = inputs,
        executable = ctx.executable.api_extractor_binary,
        arguments = ["run", "--config", ctx.outputs.config.path] + args,
        mnemonic = "ApiExtractor",
        progress_message = "Running api-extractor (https://api-extractor.com)",
    )

_api_extractor_raw_rule = rule(
    implementation = _api_extractor_raw_impl,
    attrs = {
        "entry_point": attr.label(mandatory = True, allow_single_file = True),
        "ts_config": attr.label(mandatory = True, allow_single_file = True),
        "srcs": attr.label_list(mandatory = True, allow_empty = False),
        "package_json": attr.label(mandatory = True, allow_single_file = True),
        "api_extractor_binary": attr.label(mandatory = True, executable = True, cfg = "target"),
        "report": attr.output(),
        "docModel": attr.output(),
        "untrimmedRollup": attr.output(),
        "alphaTrimmedRollup": attr.output(),
        "betaTrimmedRollup": attr.output(),
        "publicTrimmedRollup": attr.output(),
        "tsdocMetadata": attr.output(),
        "config": attr.output(),
        "package_name": attr.string(mandatory = True),
    },
)

def api_extractor_raw(name, config = "api-extractor.json", **kwargs):
    _api_extractor_raw_rule(
        name = name,
        config = config,
        ts_config = "//:tsconfig",
        api_extractor_binary = "@npm//@microsoft/api-extractor/bin:api-extractor",
        package_json = "//:package.json",
        package_name = native.package_name(),
        **kwargs
    )


def _decl_summary_gen(ctx):
    declInfo = [v[DeclarationInfo] for v in ctx.attr.srcs ]

    imports = "\n".join([ "import '" + file.path + "';"  for src in declInfo for file in src.declarations.to_list() ])

    summary_file = ctx.actions.declare_file(ctx.outputs.rollup,
        depset([x.declarations for x in declInfo] + [x.transitive_declarations for x in declInfo]))

    ctx.actions.write(
        summary_file, imports
    )

    return declaration_info(summary_file, ctx.files.srcs + ctx.files.deps)

decl_summary = rule(
    implementation = _decl_summary_gen,
    attrs = {
        "srcs": attr.label_list(allow_empty = False, providers = [ DeclarationInfo ]),
        "rollup": attr.output()
    }
)

def api_extractor(name, srcs = [], rollup_file = "summary.d.ts", **kwargs):
    decl_summary(
        name = name + "_decl_summary",
        srcs = srcs,
    )

    api_extractor_raw(
        name = name,
        entry_point = "summary.d.ts",
        srcs = [ name + "_decl_summary" ],
        **kwargs
    )
