"""Declare Chromium's Linux shared libraries as action inputs."""

def _runtime_impl(ctx):
    tar = ctx.toolchains["@aspect_bazel_lib//lib:tar_toolchain_type"]
    root = ctx.actions.declare_directory(ctx.label.name)

    # Use the executor's glibc and loader together. Bundling one without the other
    # breaks Chrome subprocesses on newer native Linux presubmit runners.
    exclude = [
        "libc.so*",
        "libc-*.so",
        "ld-linux*",
        "ld-*.so",
        "libm.so*",
        "libm-*.so",
        "libpthread*",
        "libdl*",
        "librt.so*",
        "libresolv*",
        "libnss_*.so*",
    ]
    ctx.actions.run_shell(
        inputs = [ctx.file.archive],
        outputs = [root],
        tools = tar.default.files,
        arguments = [tar.tarinfo.binary.path, ctx.file.archive.path, root.path, "--include=*lib/x86_64-linux-gnu/*", "--include=*usr/share/fonts/*"] + ["--exclude=" + pattern for pattern in exclude],
        command = """
set -eu
tar="$1"; archive="$2"; root="$3"; shift 3
mkdir -p "$root"
"$tar" -xf "$archive" -C "$root" "$@"
# Package archives can contain aliases to excluded glibc libraries.
find "$root" -type l ! -exec test -e {} \\; -delete
cat > "$root/fonts.conf" <<'XML'
<fontconfig>
  <dir prefix="relative">usr/share/fonts</dir>
  <cachedir>/tmp/fontconfig-cache</cachedir>
</fontconfig>
XML
""",
        mnemonic = "ChromiumRuntime",
    )
    return [DefaultInfo(files = depset([root]))]

chromium_runtime = rule(
    implementation = _runtime_impl,
    attrs = {"archive": attr.label(allow_single_file = True, mandatory = True)},
    toolchains = ["@aspect_bazel_lib//lib:tar_toolchain_type"],
)
