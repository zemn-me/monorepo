

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