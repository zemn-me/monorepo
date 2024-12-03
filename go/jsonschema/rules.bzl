"Generate go types from json schema."

def go_jsonschema_library(name, src, package = None, out = None):
    """
    Generate Go types for a given JSON schema.

    Args:
        name: tag name for output go_library
        src: the target JSON schema.
        package: the Go package name (defaults to same as name arg)
        out: the output go file (defaults to name + ".go")
    """
    if package == None:
        package = name
    if out == None:
        out = name + ".go"
    native.genrule(
        name = name + "_gen",
        tools = [
            "@com_github_a_h_generate//cmd/schema-generate:schema-generate",
        ],
        srcs = [
            src,
        ],
        cmd = """
$(execpath @com_github_a_h_generate//cmd/schema-generate:schema-generate) \\
    "$<" -o "$@"

        """,
        outs = [out],
    )
