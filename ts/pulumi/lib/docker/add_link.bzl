"Generate a new mtree with a symlink to a given file appended to it."

def mtree_symlink(
        name,
        link_path = None,
        src = None,
        mtree = None,
        out = None):
    """
    Generate a new mtree with a symlink to a given file appended to it.

    args:
        link_path: Where the symlink should be generated.
        src: The file to symlink to. Makefile expanded.
        mtree: The mtree file to modify.
        out: The mtree file to generate.
    """
    native.genrule(
        name = name,
        srcs = [
            mtree,
            src,
        ],
        outs = [
            out,
        ],
        cmd = """
            "$(location //ts/pulumi/lib/docker/py/add_link:add_link_bin)" \\
            --mtree_file "$(location """ + mtree + """)" \\
            --content_path "$(location """ + src + """)" \\
            --link_location """ + link_path + """ > $@
        """,
        tools = ["//ts/pulumi/lib/docker/py/add_link:add_link_bin"],
    )
