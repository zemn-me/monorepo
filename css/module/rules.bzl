"rules for css modules."

def css_module(name, srcs = []):
    native.filegroup(
        name = name,
        srcs = srcs,
    )
