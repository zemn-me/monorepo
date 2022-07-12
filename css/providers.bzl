CSSLibraryInfo = provider(
    doc = "Contains information about a set of CSS import files.",
    fields = {
        "srcs": "A depset of CSS files for this immediate group of CSS files.",
        "deps": "A depset of CSSLibraryInfo structs for this library's dependencies.",
    },
)

def css_library_info(srcs, deps = []):
    transitive_depsets = [srcs]

    for dep in deps:
        if CSSLibraryInfo in dep:
            transitive_depsets.append(dep[CSSLibraryInfo].deps)

    return CSSLibraryInfo(
        srcs = srcs,
        deps = depset(transitive = transitive_depsets),
    )
