load("//ts/lint:rules.bzl", "ts_lint")
load("//css/lint:rules.bzl", "css_lint")
load("//go/lint:rules.bzl", "go_lint")

mappings = {
    ".ts": ts_lint,
    ".tsx": ts_lint,
    ".css": css_lint,
    ".go": go_lint
}


"""
lint lints all the given srcs as per registered mappings.

srcs is expected to be an array of labels. If these labels do
not have a name ending in an extension (".js"/".ts" etc), they
will not be linted; that's mostly OK becuase it usually means
they're not an on-disk file.
"""
def lint(name = None, srcs = []):
    partitions = {}

    for src in srcs:
        name = src
        # why tf if "file.xxx" is valid syntax is Label("file.xxx") an error??
        if src.rfind("//") != -1 or src.startswith(":"):
            name = Label(src).name

        for suffix in mappings:
            linter = mappings[suffix]
            if name.endswith(suffix):
                if not suffix in partitions:
                    partitions[suffix] = []
                partitions[suffix] = partitions[suffix] + [ src ]
                break
    
    for partition in partitions:

        mappings[partition](
            name = name + partition + "_lint",
            srcs = partitions[partition]
        )

