load("@aspect_bazel_lib//lib:jq.bzl", "jq")

def upgrade_json_schema(name, src, out = None, **kwargs):
    if out == None:
        out = name + ".upgraded.json"
    jq(
        name = name,
        srcs = [src],
        filter_file = "//jq:upgrade_json_schema.jq",
        out = out,
        **kwargs
    )
