load("@npm//next:index.bzl", "next")

def next_project(name, distDir, srcs, **kwargs):
    target = "node_modules/monorepo/" + native.package_name()

    next(
        name = distDir,
        data = srcs,
        link_workspace_root = True,
        args = [ "build", target],
        output_dir = True,
        silent_on_success = True
    )

    next(
        name = "out",
        data = [ ":build" ] + srcs,
        args = [ "export", target ],
        link_workspace_root = True,
        output_dir = True,
        silent_on_success = True
    )

    native.alias(
        name = name,
        actual = "out",
    )

