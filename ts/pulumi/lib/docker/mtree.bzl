"""
Generate a new file containing the final paths from an mtree file for the given content paths.
"""

def mtree_content_paths(
        name,
        mtree_file = None,
        content_paths = [],
        out = None):
    """
    Generate a new file containing the final paths from an mtree file for the given content paths.

    args:
        mtree_file: The mtree file to extract paths from.
        content_paths: A list of content paths to search for in the mtree.
        out: The file to output the final paths.
    """
    native.genrule(
        name = name,
        srcs = [
            mtree_file,
        ] + content_paths,
        outs = [
            out,
        ],
        cmd = """
            $(location //ts/pulumi/lib/docker/py/mtree_realpath:mtree_realpath_bin) \\
            --mtree_file "$(location """ + mtree_file + """)" \\
            """ +
              " ".join(["\"$(location " + path + ")\"" for path in content_paths]) +
              """ > $@
        """,
        tools = [
            "//ts/pulumi/lib/docker/py/mtree_realpath:mtree_realpath_bin",
        ],
    )
