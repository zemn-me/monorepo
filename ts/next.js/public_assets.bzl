"""Rules for content-addressed assets served from a Next.js public directory."""

NextPublicAssetsInfo = provider(
    doc = "Content-addressed files that should be available from the Next public root.",
    fields = {
        "public_assets": "depset of tree artifacts containing digest-keyed public files",
    },
)

_CollectedNextPublicAssetsInfo = provider(
    doc = "Aspect-collected content-addressed files.",
    fields = {
        "public_assets": "depset of tree artifacts containing digest-keyed public files",
    },
)

def _hashed_public_assets_impl(ctx):
    modules = {
        target_name: ctx.actions.declare_file(module_path)
        for target_name, module_path in ctx.attr.modules.items()
    }
    public_dir = ctx.actions.declare_directory(ctx.attr.public_dir)

    exports_by_module = {target_name: [] for target_name in ctx.attr.modules}

    args = ctx.actions.args()
    args.add("generate")
    args.add(public_dir.path)
    args.add(ctx.attr.url_prefix)
    args.add(len(modules))

    for target_name, module in modules.items():
        args.add(module.path)

    inputs = []
    args.add(len(ctx.attr.assets))
    for target, spec in ctx.attr.assets.items():
        parts = spec.split("|")
        if len(parts) != 2:
            fail("asset spec for %s must be '<module target>|<export name>'" % target.label)

        target_name = parts[0]
        export_name = parts[1]
        if target_name not in modules:
            fail("asset %s references unknown module target %s" % (target.label, target_name))

        files = target.files.to_list()
        if len(files) != 1:
            fail("asset label %s must produce exactly one file" % target.label)

        src = files[0]
        inputs.append(src)
        exports_by_module[target_name].append(export_name)
        args.add(src.path)
        args.add(modules[target_name].path)
        args.add(export_name)

    ctx.actions.run(
        inputs = inputs,
        outputs = modules.values() + [public_dir],
        executable = ctx.executable._public_assets_tool,
        arguments = [args],
        mnemonic = "NextPublicAssets",
        progress_message = "Generating content-addressed public assets for %{label}",
    )

    output_groups = {
        "public_assets": depset([public_dir]),
    }
    for target_name, module in modules.items():
        output_groups[target_name] = depset([module])

    return [
        DefaultInfo(files = depset(modules.values())),
        NextPublicAssetsInfo(public_assets = depset([public_dir])),
        OutputGroupInfo(**output_groups),
    ]

_hashed_public_assets = rule(
    implementation = _hashed_public_assets_impl,
    attrs = {
        "assets": attr.label_keyed_string_dict(
            allow_files = True,
            mandatory = True,
        ),
        "modules": attr.string_dict(mandatory = True),
        "public_dir": attr.string(mandatory = True),
        "_public_assets_tool": attr.label(
            default = "//go/next.js/cmd/public_assets",
            executable = True,
            cfg = "exec",
        ),
        "url_prefix": attr.string(mandatory = True),
    },
)

def hashed_public_assets(name, assets, modules, public_dir, url_prefix):
    """Generate digest-keyed public assets and TypeScript URL manifests.

    Args:
        name: target prefix for the generated asset store.
        assets: dict mapping asset labels to "<module target>|<export name>".
        modules: dict mapping public module target names to generated module paths.
        public_dir: generated public directory path, such as "sha256".
        url_prefix: URL prefix corresponding to public_dir, such as "/sha256/".
    """

    generated = name + "_generated"
    _hashed_public_assets(
        name = generated,
        assets = assets,
        modules = modules,
        public_dir = public_dir,
        url_prefix = url_prefix,
    )

    native.filegroup(
        name = name + "_public_assets",
        srcs = [":" + generated],
        output_group = "public_assets",
    )

    for target_name in modules:
        native.filegroup(
            name = target_name,
            srcs = [":" + generated],
            output_group = target_name,
        )

def _collect_public_assets_aspect_impl(target, ctx):
    transitive = []

    if NextPublicAssetsInfo in target:
        transitive.append(target[NextPublicAssetsInfo].public_assets)

    for attr_name in ["srcs", "deps", "data", "assets"]:
        if not hasattr(ctx.rule.attr, attr_name):
            continue

        attr = getattr(ctx.rule.attr, attr_name)
        if type(attr) != type([]):
            attr = [attr]

        for dep in attr:
            if _CollectedNextPublicAssetsInfo in dep:
                transitive.append(dep[_CollectedNextPublicAssetsInfo].public_assets)

    return [_CollectedNextPublicAssetsInfo(public_assets = depset(transitive = transitive))]

_collect_public_assets_aspect = aspect(
    implementation = _collect_public_assets_aspect_impl,
    attr_aspects = ["srcs", "deps", "data", "assets"],
)

def _collect_public_assets_impl(ctx):
    public_dir = ctx.actions.declare_directory(ctx.attr.public_dir)

    transitive = []
    for dep in ctx.attr.deps:
        if _CollectedNextPublicAssetsInfo in dep:
            transitive.append(dep[_CollectedNextPublicAssetsInfo].public_assets)

    public_assets = depset(transitive = transitive)
    args = ctx.actions.args()
    args.add("collect")
    args.add(public_dir.path)
    args.add_all(public_assets, expand_directories = True)

    ctx.actions.run(
        inputs = public_assets,
        outputs = [public_dir],
        executable = ctx.executable._public_assets_tool,
        arguments = [args],
        mnemonic = "NextPublicAssets",
        progress_message = "Collecting content-addressed public assets for %{label}",
    )

    return [
        DefaultInfo(files = depset([public_dir])),
    ]

collect_public_assets = rule(
    implementation = _collect_public_assets_impl,
    attrs = {
        "deps": attr.label_list(
            aspects = [_collect_public_assets_aspect],
            mandatory = True,
        ),
        "public_dir": attr.string(mandatory = True),
        "_public_assets_tool": attr.label(
            default = "//go/next.js/cmd/public_assets",
            executable = True,
            cfg = "exec",
        ),
    },
)
