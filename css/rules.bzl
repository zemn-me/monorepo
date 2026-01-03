def css_library(name, srcs = [], visibility = None, **kwargs):
    """
    Groups CSS module assets so other rules can depend on them.
    """
    native.filegroup(
        name = name,
        srcs = srcs,
        visibility = visibility,
        **kwargs
    )
