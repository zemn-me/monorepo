load("//ts:rules.bzl", "ts_project")

genrule(
    name = "HEAD",
    srcs = ["//:.git/HEAD"],
    outs = ["head_ref.ts"],
    cmd_bash = """
echo 'export const HEAD = "'"$$(cat $<)"'" as const;' > $@
echo 'export default HEAD;' >> $@
    """,
)

ts_project(
    name = "git",
    srcs = [
        "head.ts",
        "head_ref.ts",
        "index.ts",
    ],
)
