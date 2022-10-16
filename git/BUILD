load("//ts:rules.bzl", "ts_project")

package(default_visibility = ["//:__subpackages__"])

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
        "index.tsx",
    ],
    deps = [ "git_genfiles" ]
)

ts_project(
    name = "git_genfiles",
    srcs = [ "head_ref.ts" ]
)
