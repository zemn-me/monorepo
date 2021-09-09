
genrule(
    name = "multiplayer",
    outs = [ "build.tar.gz"],
    srcs = glob(["**/*"]),
    exec_tools = [
        "@npm//next/bin:next",
        "@npm//:node_modules"

    ] + [],
    cmd = """
        $(execpath @npm//next/bin:next) build $$(dirname $(location :next.config.js));
        tar -czvf $@ $$(dirname $(location :next.config.js))
    """
)
