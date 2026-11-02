"""Formatting rules for MDX source files."""

def _workspace_path(file):
    return file.short_path.removeprefix("../")

def _mdx_format_test_impl(ctx):
    script = ctx.actions.declare_file(ctx.label.name + ".sh")
    src_paths = [_workspace_path(src) for src in ctx.files.srcs]
    script_content = """#!/usr/bin/env bash
set -euo pipefail

workspace="${TEST_WORKSPACE:-_main}"
runfiles_root="${RUNFILES_DIR:-$0.runfiles}"
prettier="${runfiles_root}/${workspace}/%s"
format_headings="${runfiles_root}/${workspace}/%s"
prettier_config="${runfiles_root}/${workspace}/%s"
editorconfig="${runfiles_root}/${workspace}/%s"
export BAZEL_BINDIR="."
tmp_root="${TEST_TMPDIR}/workspace"
mkdir -p "${tmp_root}"
cp "${prettier_config}" "${tmp_root}/.prettierrc.json"
cp "${editorconfig}" "${tmp_root}/.editorconfig"
status=0

for src in %s; do
  runfile="${runfiles_root}/${workspace}/${src}"
  tmpfile="${tmp_root}/${src}"
  mkdir -p "$(dirname "${tmpfile}")"
  cp "${runfile}" "${tmpfile}"
  (
    cd "${tmp_root}"
    "${prettier}" \\
      --write \\
      --parser mdx \\
      --prose-wrap always \\
      --print-width 80 \\
      --single-quote \\
      "${tmpfile}" >/dev/null
    "${format_headings}" --write "${tmpfile}"
  )
  if ! diff -u "${runfile}" "${tmpfile}"; then
    echo >&2
    echo >&2 "${src} is not formatted. Run: bazel run %s.fix"
    status=1
  fi
done

exit "${status}"
""" % (
        ctx.executable._prettier.short_path,
        ctx.executable._format_headings.short_path,
        ctx.file._prettier_config.short_path,
        ctx.file._editorconfig.short_path,
        " ".join(["'%s'" % src for src in src_paths]),
        str(ctx.label),
    )
    ctx.actions.write(script, script_content, is_executable = True)
    runfiles = ctx.runfiles(files = ctx.files.srcs + [
        ctx.executable._prettier,
        ctx.executable._format_headings,
        ctx.file._editorconfig,
        ctx.file._prettier_config,
    ])
    runfiles = runfiles.merge(ctx.attr._prettier[DefaultInfo].default_runfiles)
    runfiles = runfiles.merge(ctx.attr._format_headings[DefaultInfo].default_runfiles)
    return [DefaultInfo(executable = script, runfiles = runfiles)]

def _mdx_format_fix_impl(ctx):
    script = ctx.actions.declare_file(ctx.label.name + ".sh")
    src_paths = [_workspace_path(src) for src in ctx.files.srcs]
    script_content = """#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BUILD_WORKSPACE_DIRECTORY:-}" ]]; then
  echo >&2 "This formatter must be run with bazel run."
  exit 1
fi

workspace="${TEST_WORKSPACE:-_main}"
runfiles_root="${RUNFILES_DIR:-$0.runfiles}"
prettier="${runfiles_root}/${workspace}/%s"
format_headings="${runfiles_root}/${workspace}/%s"
export BAZEL_BINDIR="."

args=()
for src in %s; do
  args+=("${BUILD_WORKSPACE_DIRECTORY}/${src}")
done

cd "${runfiles_root}/${workspace}"
"${prettier}" \\
  --write \\
  --parser mdx \\
  --prose-wrap always \\
  --print-width 80 \\
  --single-quote \\
  "${args[@]}"
"${format_headings}" --write "${args[@]}"
""" % (
        ctx.executable._prettier.short_path,
        ctx.executable._format_headings.short_path,
        " ".join(["'%s'" % src for src in src_paths]),
    )
    ctx.actions.write(script, script_content, is_executable = True)
    runfiles = ctx.runfiles(files = [
        ctx.executable._format_headings,
        ctx.executable._prettier,
    ])
    runfiles = runfiles.merge(ctx.attr._prettier[DefaultInfo].default_runfiles)
    runfiles = runfiles.merge(ctx.attr._format_headings[DefaultInfo].default_runfiles)
    return [DefaultInfo(executable = script, runfiles = runfiles)]

_mdx_format_test = rule(
    implementation = _mdx_format_test_impl,
    attrs = {
        "srcs": attr.label_list(allow_files = [".mdx"]),
        "_prettier": attr.label(
            default = "//mdx:prettier",
            executable = True,
            cfg = "exec",
        ),
        "_format_headings": attr.label(
            default = "//mdx:format_headings",
            executable = True,
            cfg = "exec",
        ),
        "_editorconfig": attr.label(
            default = "//:.editorconfig",
            allow_single_file = True,
        ),
        "_prettier_config": attr.label(
            default = "//:.prettierrc.json",
            allow_single_file = True,
        ),
    },
    test = True,
)

_mdx_format_fix = rule(
    implementation = _mdx_format_fix_impl,
    attrs = {
        "srcs": attr.label_list(allow_files = [".mdx"]),
        "_prettier": attr.label(
            default = "//mdx:prettier",
            executable = True,
            cfg = "exec",
        ),
        "_format_headings": attr.label(
            default = "//mdx:format_headings",
            executable = True,
            cfg = "exec",
        ),
    },
    executable = True,
)

def mdx_format_test(name, srcs):
    _mdx_format_test(
        name = name,
        srcs = srcs,
        size = "small",
    )
    _mdx_format_fix(
        name = name + ".fix",
        srcs = srcs,
    )
