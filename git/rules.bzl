

def git_commit_affecting_files(name, srcs = [], **kwargs):
    native.filegroup(
        name = name + "_srcs",
        srcs = srcs
    )
    native.genrule(
        name = name,
        srcs = [ "//:.git", name + "_srcs" ],
        cmd_bash = """
git log -n 1 --pretty=format:%H -- $(rootpaths :""" + name + """_srcs) > $@
        """,
        outs = [ name + ".gitref" ]
    )

def source_files_for_rule(name, rule, **kwargs):
    rulename = native.repository_name() + "//" + native.package_name() + rule
    native.genquery(
        name = name,
        expression = "filter(\"^//\", kind(\"source file\", deps(" + rulename + ")))",
        scope = [ rulename ]
    )