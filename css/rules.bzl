"rules for css files"

def css_files(name, srcs = []):
    js_library(
        name = name,
        srcs = srcs,
        deps = [
            "//:base_defs",
        ],
    )
