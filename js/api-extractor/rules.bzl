load("@npm//:@microsoft/api-extractor/package_json.bzl", "bin")
load("//js:rules.bzl", "copy_to_bin")
load("//js/api-extractor/config_gen:rules.bzl", "api_extractor_config")

def api_extractor(name, package_json = "//:package_json", tsdoc_metadata = "tsdoc-metadata.json", doc_model = None, report = None, srcs = None, public_trimmed_rollup = None, entry_point = None, config = "api-extractor.json", **kwargs):
    copy_to_bin(
        name = name + "_main_entry_point_in_bin",
        srcs = [entry_point],
    )

    outs = []

    if doc_model != None:
        outs.append(doc_model)

    if report != None:
        outs.append(report)

    if public_trimmed_rollup != None:
        outs.append(public_trimmed_rollup)

    if tsdoc_metadata != None:
        outs.append(tsdoc_metadata)

    project_folder = "/".join([".." for x in native.package_name().split("/")])
    api_extractor_config(
        name = name + "_config",
        out = config,
        entry_point = name + "_main_entry_point_in_bin",
        public_trimmed_rollup =
            native.package_name() + "/" + public_trimmed_rollup if public_trimmed_rollup != None else None,
        report = native.package_name() + "/" + report,
        ts_config = "//:tsconfig",
        project_folder = project_folder,
        doc_model = native.package_name() + "/" + doc_model if doc_model != None else None,
        tsdoc_metadata = native.package_name() + "/" + tsdoc_metadata,
    )

    native.filegroup(
        name = name + "_types",
        srcs = srcs,
        output_group = "types",
    )

    copy_to_bin(
        name = name + "_config_in_bin",
        srcs = [name + "_config"],
    )

    bin.api_extractor(
        name = name,
        srcs = srcs + [name + "_types", package_json, "//:tsconfig", name + "_config_in_bin", name + "_main_entry_point_in_bin"],
        args = ["run", "--local", "--config", "../../../$(location " + name + "_config_in_bin)"],
        outs = outs,
        **kwargs
    )

"""
        config="api-extractor.json",
        report= 'report.api.md',
        doc_model = 'model.api.json',
        untrimmedRollup= 'api.d.ts',
        alphaTrimmedRollup= 'api-alpha.d.ts',
        betaTrimmedRollup= 'api-beta.d.ts',
        public_trimmed_rollup=  'api-public.d.ts',
        tsdocMetadata= 'tsdoc-metadata.json',

        report= report,
        untrimmedRollup= untrimmedRollup,
        doc_model = doc_model,
        alphaTrimmedRollup= alphaTrimmedRollup,
        betaTrimmedRollup= betaTrimmedRollup,
        public_trimmed_rollup=  public_trimmed_rollup,
"""
