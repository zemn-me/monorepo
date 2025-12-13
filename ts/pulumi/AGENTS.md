# hello pulumi robot

Notes for Pulumi/TypeScript tooling:

- When invoking Bazel-built scripts via `@pulumi/command`, forward `RUNFILES_DIR`, `RUNFILES_MANIFEST_FILE`, `JAVA_RUNFILES`, and `PATH` instead of replacing the environment; the runfiles shim needs these to locate `runfiles.bash`.
