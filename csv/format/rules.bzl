def csv_format(name, src = None, out = None, separator = ",", **kwargs):
    if out == None:
        out = src + "_formatted.csv"

    native.genrule(
        name = name,
        tools = ["//go/cmd/csvpretty:csvpretty"],
        cmd_bash = """
            $(execpath //go/cmd/csvpretty:csvpretty) \\
                --input "$<" \\
                --output "$@" \\
                --comma \"""" + separator + """\"
        """,
        outs = [out],
        srcs = [src],
        **kwargs
    )
