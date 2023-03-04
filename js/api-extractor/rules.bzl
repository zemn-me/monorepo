load("@aspect_rules_js//js:providers.bzl", "JsInfo")
load("@bazel_skylib//lib:paths.bzl", "paths")
load("//js:rules.bzl", "copy_to_bin", "js_library")
load("@npm//:@microsoft/api-extractor/package_json.bzl", "bin")

"""
Trying to make this compatible with rules_js:
    1. [ ] move config generation into its own action
    2. [ ] move call into a macro
    3. [ ] ensure node_modules resolution is correct.
"""

def _api_extractor_config_impl(ctx):

    tsdocMetadata = {
        "enabled": False,
    }

    if ctx.attr.tsdocMetadata != None:
        tsdocMetadata["enabled"] = True
        tsdocMetadata["tsdocMetadataFilePath"] = "<projectFolder>/" + ctx.attr.tsdocMetadata

    dtsRollup = {
        "enabled": False,
    }

    if ctx.attr.untrimmedRollup != None:
        dtsRollup["enabled"] = True
        dtsRollup["untrimmedFilePath"] = "<projectFolder>/" + ctx.attr.untrimmedRollup

    if ctx.attr.alphaTrimmedRollup != None:
        dtsRollup["enabled"] = True
        dtsRollup["alphaTrimmedFilePath"] = "<projectFolder>/" + ctx.attr.alphaTrimmedRollup

    if ctx.attr.betaTrimmedRollup != None:
        dtsRollup["enabled"] = True
        dtsRollup["betaTrimmedFilePath"] = "<projectFolder>/" + ctx.attr.betaTrimmedRollup

    if ctx.attr.publicTrimmedRollup != None:
        dtsRollup["enabled"] = True
        dtsRollup["betaTrimmedFilePath"] = "<projectFolder>/" + ctx.attr.publicTrimmedRollup

    docModel = {
        "enabled": False,
    }

    if ctx.attr.docModel != None:
        docModel["enabled"] = True
        docModel["apiJsonFilePath"] = "<projectFolder>/" + ctx.attr.docModel

    apiReport = {
        "enabled": False,
    }

    if ctx.attr.report != None:
        # Will not actually generate unless it thinks it's doing a 'local'
        # build due to intended development flow
        apiReport["enabled"] = True
        apiReport["reportFileName"] = paths.basename(ctx.attr.report)
        apiReport["reportFolder"] = "<projectFolder>/" + paths.dirname(ctx.attr.report)

    compiler = {}

    #compiler["tsconfigFilePath"] = "<projectFolder>/" + ctx.file.ts_config.path

    config = {
        "mainEntryPointFilePath": "<projectFolder>/../../../" + ctx.file.entry_point.path,
        "apiReport": apiReport,
        "compiler": compiler,
        "docModel": docModel,
        "dtsRollup": dtsRollup,
        "projectFolder": ".",
        "tsdocMetadata": tsdocMetadata,
    }

    ctx.actions.write(
        output = ctx.outputs.out,
        content = json.encode_indent(config),
    )

_api_extractor_config = rule(
    implementation = _api_extractor_config_impl,
    attrs = {
        "entry_point": attr.label(mandatory = True, allow_single_file = True),
        "ts_config": attr.label(mandatory = True, allow_single_file = True),
        "package_json": attr.label(mandatory = True, allow_single_file = True),
        "report": attr.string(),
        "docModel": attr.string(),
        "untrimmedRollup": attr.string(),
        "alphaTrimmedRollup": attr.string(),
        "betaTrimmedRollup": attr.string(),
        "publicTrimmedRollup": attr.string(),
        "tsdocMetadata": attr.string(),
        "out": attr.output(),
        "package_name": attr.string(mandatory = True),
    },
)


def api_extractor(name, srcs = None, publicTrimmedRollup = None, entry_point = None, config = "api-extractor.json", **kwargs):
    copy_to_bin(
        name = name + "_main_entry_point_in_bin",
        srcs = [ entry_point ]
    )

    _api_extractor_config(
        name = name + "_config",
        out = config,
        package_json = "//:package.json",
        package_name = native.package_name(),
        entry_point = name + "_main_entry_point_in_bin",
        publicTrimmedRollup = publicTrimmedRollup,
        ts_config = "//:tsconfig",
    )

    copy_to_bin(
        name = name + "_config_in_bin",
        srcs = [ name + "_config" ]
    )

    bin.api_extractor(
        name = name,
        srcs = srcs + [ name + "_config_in_bin" ],
        args = [ "run", "--config", "$(location " + name + "_config_in_bin)" ], 
        outs = [ publicTrimmedRollup ],
        **kwargs
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