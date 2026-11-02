"""Import the shared pnpm pin with its reviewed npm registry integrity."""

load("@aspect_rules_js//npm:repositories.bzl", "pnpm_repository")

def _pnpm_impl(module_ctx):
    for mod in module_ctx.modules:
        for config in mod.tags.tool:
            if not mod.is_root:
                fail("Only the root module may configure the pnpm tool")

            # Reading the whole package.json makes unrelated dependency updates
            # conflict in MODULE.bazel.lock. The bootstrap derives this small
            # lock from packageManager; renovate_pnpm_test checks the actual
            # executable version against that source pin.
            lock = json.decode(module_ctx.read(config.integrity_lock))
            pnpm_repository(
                name = "pnpm",
                pnpm_version = (lock["version"], lock["integrity"]),
            )

pnpm = module_extension(
    implementation = _pnpm_impl,
    tag_classes = {
        "tool": tag_class(attrs = {
            "integrity_lock": attr.label(mandatory = True),
        }),
    },
)
