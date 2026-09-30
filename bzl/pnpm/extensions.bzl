"""Import the shared pnpm pin with its reviewed npm registry integrity."""

load("@aspect_rules_js//npm:repositories.bzl", "pnpm_repository")

def _pnpm_impl(module_ctx):
    for mod in module_ctx.modules:
        for config in mod.tags.tool:
            if not mod.is_root:
                fail("Only the root module may configure the pnpm tool")
            manifest = json.decode(module_ctx.read(config.package_json))
            lock = json.decode(module_ctx.read(config.integrity_lock))
            if manifest["packageManager"] != "pnpm@" + lock["version"]:
                fail("pnpm integrity lock is stale; run python3 py/ci/post_upgrade/pnpm.py")
            pnpm_repository(
                name = "pnpm",
                pnpm_version = (lock["version"], lock["integrity"]),
            )

pnpm = module_extension(
    implementation = _pnpm_impl,
    tag_classes = {
        "tool": tag_class(attrs = {
            "package_json": attr.label(mandatory = True),
            "integrity_lock": attr.label(mandatory = True),
        }),
    },
)
