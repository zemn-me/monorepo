load("//ts:rules.bzl", "ts_project")

tstests = glob(["*_test.ts"])

tsfiles = [f for f in glob(["*.ts"]) if f not in tstests]

ts_project(
    name = "example",
    srcs = tsfiles,
    visibility = ["//project/cultist:__subpackages__"],
)

exports_files(
    ["savestate.ts"],
    ["//project/cultist:__subpackages__"],
)
