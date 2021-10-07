load("//:rules.bzl", "ts_project")

tstests = glob(["*_test.ts"])

tsfiles = [f for f in glob(["*.ts"]) if f not in tstests]

ts_project(
    name = "example",
    srcs = tsfiles,
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig",
    visibility = ["//cultist:__subpackages__"],
)

exports_files(
    ["savestate.ts"],
    ["//cultist:__subpackages__"],
)
