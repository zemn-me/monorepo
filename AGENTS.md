# Repository guidance

Keep AGENTS.md notes short, durable, and specific to this repo. Put local
knowledge in the nearest relevant AGENTS.md; add notes only when they will
save future work, not as a changelog. Code comments should explain lasting
intent rather than edit history.

## Workflow and completion

Use a branch and pull request unless the user explicitly requests a direct
write to the default branch. This checkout is Sapling-backed: use `sl amend`
for amendments; `git commit --amend` can leave `.git/sl` pointing at a Git
node Sapling has not imported.

Carry requested changes through implementation, relevant validation, and
fixes for failures they cause. Routine local edits and affected checks do
not need separate approval. Once those checks pass, report the result and
any remaining blockers; broaden testing when the change or a failure calls
for it. Publishing, merging, and deploying follow the user's requested scope.

## Build and test

- This is a Bazel monorepo. Use the wrappers in `sh/bin` (on `$PATH`);
  `bazel` maps to `./sh/bin/bazel`. Pass absolute file paths such as
  `$(pwd)/path/to/file` to tools launched through Bazel.
- Run `./sh/bin/gazelle` to update BUILD metadata before submitting.
  Prefer narrow Gazelle directives or explicit BUILD metadata over
  `# gazelle:ignore` for new code.
- Validate affected packages with `bazel test //path/to/changes/...`.
  Use `bazel query` to select narrower relevant targets when needed;
  let slow Bazel runs finish or time out naturally.
- For features, prefer integration tests of user-visible behaviour.
  Types can cover invariants they enforce. Observe the DOM, network, or
  existing APIs instead of adding custom `window.*` globals for tests.
- For background test services, use `rules_itest` and `inject_iservice` with
  auto-assigned ports from `ASSIGNED_PORTS` (for example, a struct field
  tagged `json:"@@//path:service"`), not hard-coded addresses.

## Dependency and tooling changes

- When changing `MODULE.bazel`, run `./sh/bin/bazel test //:bazel_lint`
  and fix buildifier output.
- When bumping `GO_VERSION`, keep `golang.org/x/tools/gopls` compatible;
  stale `x/tools/internal/tokeninternal` can fail on Go's private
  `go/token.FileSet` layout.
- Keep TypeScript 7 as the canonical `typescript` package. Legacy compiler
  API consumers (currently Pulumi) need a package-local TypeScript 5 peer
  via pnpm `packageExtensions`.
- For Renovate-managed `http_archive` checksums, put `# auto-integrity`
  immediately before `url`/`urls` so post-upgrade refreshes the checksum.
  Use immutable archive URLs; for FFmpeg binaries, pin BtbN dated monthly
  autobuild tags because their last monthly build is retained.
- For Biome safe lint fixes and import sorting, run
  `./sh/bin/biome check --write --formatter-enabled=false --linter-enabled=true --assist-enabled=true --enforce-assist=true --config-path=$(pwd)/biome.json --no-errors-on-unmatched $(pwd)/path/to/file-or-dir`.

## Code boundaries

- Bazel generates outputs; do not commit generated files. `//:base_defs`
  generates CSS module `.d.ts` types.
- Code under `project/` should not import another project unless the logic
  is specific to that project (for example, the shared zemn.me API client).
  Put broadly reusable code in `ts/...` or another shared language root.
- For timezone-aware TypeScript calendar math, use `Temporal.ZonedDateTime`
  from `temporal-polyfill` rather than custom offset or `Intl.formatToParts`
  arithmetic.
