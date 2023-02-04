# BUG ON THIS LINE!! not sure how to resolve it but i want to go get sushi
load("@aspect_rules_js//js:providers.bzl", "JsInfo", "js_info")

def _api_extractor_impl(ctx):
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
        args.append("--local")
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

    inputs = [ctx.outputs.config, ctx.file.entry_point, ctx.file.ts_config, ctx.file.package_json] + ctx.files.srcs

    for deps in [src[JsInfo].transitive_declarations.to_list() for src in ctx.attr.srcs if JsInfo in src]:
        inputs += deps

    ctx.actions.run(
        outputs = output_files,
        inputs = inputs,
        executable = ctx.executable.api_extractor_binary,
        arguments = ["run", "--config", ctx.outputs.config.path] + args,
        mnemonic = "ApiExtractor",
        progress_message = "Running api-extractor (https://api-extractor.com)",
    )

_api_extractor_rule = rule(
    implementation = _api_extractor_impl,
    attrs = {
        "entry_point": attr.label(mandatory = True, allow_single_file = True),
        "ts_config": attr.label(mandatory = True, allow_single_file = True),
        # must be JsInfo (.d.ts files)
        "srcs": attr.label_list(mandatory = True, allow_files = True, allow_empty = False),
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

"""
        config="api-extractor.json",
        report= 'report.api.md',
        docModel = 'model.api.json',
        untrimmedRollup= 'api.d.ts',
        alphaTrimmedRollup= 'api-alpha.d.ts',
        betaTrimmedRollup= 'api-beta.d.ts',
        publicTrimmedRollup=  'api-public.d.ts',
        tsdocMetadata= 'tsdoc-metadata.json',

        report= report,
        untrimmedRollup= untrimmedRollup,
        docModel = docModel,
        alphaTrimmedRollup= alphaTrimmedRollup,
        betaTrimmedRollup= betaTrimmedRollup,
        publicTrimmedRollup=  publicTrimmedRollup,
"""

def api_extractor(name, config = "api-extractor.json", **kwargs):
    _api_extractor_rule(
        name = name,
        config = config,
        ts_config = "//:tsconfig",
        api_extractor_binary = "@npm//@microsoft/api-extractor/bin:api-extractor",
        package_json = "//:package.json",
        package_name = native.package_name(),
        **kwargs
    )
