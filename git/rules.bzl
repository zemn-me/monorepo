def git_commit_affecting_files(name, srcs = [], **kwargs):
    native.filegroup(
        name = name + "_srcs",
        srcs = srcs,
    )
    native.genrule(
        name = name,
        srcs = ["//:.git", name + "_srcs"],
        cmd_bash = """
git log -n 1 --pretty=format:%H -- $(rootpaths :""" + name + """_srcs) > $@
        """,
        outs = [name + ".gitref"],
    )

def source_files_for_rule(name, rule, **kwargs):
    rulename = native.repository_name() + "//" + native.package_name() + rule
    native.genquery(
        name = name + "_labels",
        expression = "filter(\"^//\", kind(\"source file\", deps(" + rulename + ")))",
        scope = [rulename],
        opts = [],
    )

    native.genrule(
        name = name,
        srcs = [name + "_labels"],
        # turn labels into paths (for whatever reason, genquery doesn't let you do this)
        cmd_bash = "sed -r 's/\\/\\///;s/:/\\//g;s/^[\\/]+//' $< > $@",
        outs = [name + "_labels.out"],
    )

def commit_affecting_rule(name, rule, **kwargs):
    source_files_for_rule(
        name = name + "_source_files",
        rule = rule,
        **kwargs
    )

    native.genrule(
        name = name,
        srcs = ["//:.git", ":" + name + "_source_files"],
        cmd_bash = """
git log -n 1 --pretty=format:%H -- $$(cat $(location :""" + name + "_source_files" + """)) > $@
        """,
        outs = [name + ".gitref"],
    )
