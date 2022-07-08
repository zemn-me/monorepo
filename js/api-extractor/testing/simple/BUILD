load("//js/api-extractor:rules.bzl", "api_extractor")
load("//:rules.bzl", "ts_project")

api_extractor(
    name = "collate",
    srcs = [":project_ts"],
    entry_point = "something.d.ts",
    publicTrimmedRollup = "rollup.d.ts",
)

ts_project(
    name = "project",
    srcs = ["something.ts"],
)
