load("//js:rules.bzl", "js_run_binary")

def api_extractor_config(name, tsdoc_metadata = None, project_folder = None, report = None, doc_model = None, out = None, ts_config = None, entry_point = None, public_trimmed_rollup = None, **kwargs):
    args = []
    outs = []
    srcs = []

    if ts_config != None:
        args.extend(["--ts-config", "$(location " + ts_config + ")"])
        srcs.extend([ts_config])

    if entry_point != None:
        args.extend(["--entry-point", "$(location " + entry_point + ")"])
        srcs.extend([entry_point])

    if out != None:
        args.extend(["--out", "$(location " + out + ")"])
        outs.extend([out])

    if public_trimmed_rollup != None:
        args.extend(["--public-trimmed-rollup", public_trimmed_rollup])

    if doc_model != None:
        args.extend(["--doc-model", doc_model])
    
    if report != None:
        args.extend(["--report", report ])

    if project_folder != None:
        args.extend(["--project-folder", project_folder])

    if tsdoc_metadata != None:
        args.extend(["--tsdoc-metadata", tsdoc_metadata])

    args.extend(["--relativize"])

    js_run_binary(
        name = name,
        outs = outs,
        args = args,
        srcs = srcs,
        tool = "//js/api-extractor/config_gen",
        **kwargs
    )
