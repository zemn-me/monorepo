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

_TS_IDENTIFIER_START = "_$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
_TS_IDENTIFIER_PART = _TS_IDENTIFIER_START + "0123456789"

def _is_ts_identifier(value):
    if len(value) == 0 or value[0] not in _TS_IDENTIFIER_START:
        return False

    for char in value.elems():
        if char not in _TS_IDENTIFIER_PART:
            return False

    return True

def _validate_public_dir(public_dir):
    if len(public_dir) == 0:
        fail("public_dir must not be empty")
    if public_dir != public_dir.strip("/"):
        fail("public_dir must be relative and must not start or end with '/': %s" % public_dir)

    for part in public_dir.split("/"):
        if part in ["", ".", ".."]:
            fail("public_dir must not contain empty, '.', or '..' path segments: %s" % public_dir)

def _hashed_public_assets_impl(ctx):
    if len(ctx.attr.outs) != 1:
        fail("outs must contain exactly one generated TypeScript module")
    _validate_public_dir(ctx.attr.public_dir)

    module = ctx.actions.declare_file(ctx.attr.outs[0])
    public_dir = ctx.actions.declare_directory(ctx.attr.public_dir)

    args = ctx.actions.args()
    args.add("generate")
    args.add(public_dir.path)
    args.add("/%s/" % ctx.attr.public_dir.strip("/"))
    args.add(module.path)

    inputs = []
    args.add(len(ctx.attr.assets))
    for target, export_name in ctx.attr.assets.items():
        if not _is_ts_identifier(export_name):
            fail("asset export name must be a TypeScript identifier, got %s for %s" % (export_name, target.label))

        files = target.files.to_list()
        if len(files) != 1:
            fail("asset label %s must produce exactly one file" % target.label)

        src = files[0]
        inputs.append(src)
        args.add(src.path)
        args.add(export_name)

    ctx.actions.run(
        inputs = inputs,
        outputs = [module, public_dir],
        executable = ctx.executable._public_assets_tool,
        arguments = [args],
        mnemonic = "NextPublicAssets",
        progress_message = "Generating content-addressed public assets for %{label}",
    )

    output_groups = {
        "public_assets": depset([public_dir]),
    }

    return [
        DefaultInfo(files = depset([module])),
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
        "outs": attr.string_list(mandatory = True),
        "public_dir": attr.string(mandatory = True),
        "_public_assets_tool": attr.label(
            default = "//go/next.js/cmd/public_assets",
            executable = True,
            cfg = "exec",
        ),
    },
)

def hashed_public_assets(name, assets, outs, public_dir):
    """Generate digest-keyed public assets and TypeScript URL manifests.

    Args:
        name: target prefix for the generated asset store.
        assets: dict mapping asset labels to generated TypeScript export names.
        outs: list containing the single generated TypeScript module path.
        public_dir: generated public directory path, such as "sha256".
    """

    generated = name + "_generated"
    _hashed_public_assets(
        name = generated,
        assets = assets,
        outs = outs,
        public_dir = public_dir,
    )

    native.filegroup(
        name = name + "_public_assets",
        srcs = [":" + generated],
        output_group = "public_assets",
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
    _validate_public_dir(ctx.attr.public_dir)
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
