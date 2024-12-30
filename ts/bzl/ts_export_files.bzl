
load("@aspect_bazel_lib//lib:expand_template.bzl", "expand_template_rule")
load("//ts:rules.bzl", "ts_project")

def ts_export_files(
    name,
    src,
    var_name = None,
    out = None,
):
"""
Generate a ts file containing all the outputs of a bazel tag.

The ts module has the outputs as data (runfiles), so importing it will always expose the outputs at runtime.

Args:
    name: name of the resulting ts_project module.
    src: the bazel tag.
    var_name: name of exported var.
    out: name of generated ts file.
"""
    if var_name == None:
        var_name = src.replace("//", "").replace("/", "_")
        .replace(":", "")

    if out == None:
        out = name + ".ts"

    expand_template_rule(
        name = name + "_tsfiles",
        template = "//ts/bzl:outputs.tmpl.ts",
        out = out,
        data = [
            src
        ],
        substitutions = {
            "_VAR_NAME": var_name,
            "_OUTPUTS": "$(rlocationpaths " + src + ")"
        }
    )

    ts_project(
        name = name,
        srcs = [
            out
        ],
        deps = [
            "//:node_modules/@bazel/runfiles"
        ],
        data = [
            src
        ]
    )
