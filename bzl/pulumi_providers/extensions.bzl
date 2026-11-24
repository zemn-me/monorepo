"""Package Pulumi's native providers at the versions of their Node SDKs."""

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

_CDN = "https://get.pulumi.com/releases/plugins/"
_PLATFORMS = [os + "-" + arch for os in ["darwin", "linux", "windows"] for arch in ["amd64", "arm64"]]

def _release_digests(ctx, name, version):
    release = "pulumi-%s_%s_checksums.txt" % (name, version)
    ctx.download(_CDN + release, release)
    digests = {}
    for line in ctx.read(release, watch = "no").splitlines():
        parts = [part for part in line.split(" ") if part]
        if len(parts) == 2 and len(parts[0]) == 64:
            digests[parts[1].removeprefix("./")] = parts[0]

    # Some Pulumi release manifests only contain SHA-1. GitHub publishes
    # SHA-256 digests for the same release assets.
    if not digests:
        ctx.download("https://api.github.com/repos/pulumi/pulumi-%s/releases/tags/v%s" % (name, version), "release.json")
        for asset in json.decode(ctx.read("release.json", watch = "no"))["assets"]:
            digest = asset.get("digest") or ""
            if digest.startswith("sha256:"):
                digests[asset["name"]] = digest.removeprefix("sha256:")
    return digests

def _hub_impl(ctx):
    ctx.file("BUILD.bazel", ctx.attr.build)
    ctx.file("versions.json", ctx.attr.versions)

_hub = repository_rule(
    implementation = _hub_impl,
    attrs = {"build": attr.string(), "versions": attr.string()},
)

def _providers_impl(ctx):
    package = json.decode(ctx.read(Label("//:package.json")))
    sdk_versions = package["devDependencies"] | package["dependencies"]
    versions = {name: sdk_versions["@pulumi/" + name] for name in ["aws", "command", "gcp", "random"]}
    facts = {}
    targets = {platform: [] for platform in _PLATFORMS}
    for name, version in versions.items():
        key = "%s@%s" % (name, version)
        known = ctx.facts.get(key)
        digests = known if known != None else _release_digests(ctx, name, version)
        facts[key] = {}
        for platform in _PLATFORMS:
            archive = "pulumi-resource-%s-v%s-%s.tar.gz" % (name, version, platform)
            digest = digests[archive]
            facts[key][archive] = digest
            directory = "resource-%s-v%s" % (name, version)
            binary = "pulumi-resource-" + name + (".exe" if platform.startswith("windows-") else "")
            repo = "pulumi_%s_provider_%s" % (name, platform.replace("-", "_"))
            http_archive(
                name = repo,
                urls = [_CDN + archive],
                sha256 = digest,
                add_prefix = directory,
                build_file_content = """alias(name = %r, actual = %r, visibility = ["//visibility:public"])""" % (binary, directory + "/" + binary),
            )
            targets[platform].append("@%s//:%s" % (repo, binary))

    _hub(
        name = "pulumi_providers",
        versions = json.encode(versions),
        build = "\n".join([
            """filegroup(name = %r, srcs = %r, visibility = ["//visibility:public"])""" % (platform.replace("-", "_"), srcs + ["versions.json"])
            for platform, srcs in targets.items()
        ]),
    )
    return ctx.extension_metadata(reproducible = True, facts = facts)

pulumi_providers = module_extension(implementation = _providers_impl)
