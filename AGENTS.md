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

When monitoring CI or a merge queue to ensure a PR merges, check every five
to ten minutes rather than polling constantly. Use scheduled follow-ups or
automation when the agent supports them.

When staging fails because a component is misconfigured (for example, an invalid
AWS resource name or deployment archive), fix the configuration and follow up
with a separate PR adding a regression test to the normal presubmit checks.
Prefer shared validation across affected component types and both staging and
production, and verify that the test rejects the configuration that failed.
Run the affected checks and enable auto-merge on the follow-up PR; do not bypass
required checks. Record the failure class and test coverage in its description.

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
- Assert observable results through public interfaces. Avoid source-text
  checks and mock call sequences that merely restate the implementation;
  behaviour-preserving refactors should not require rewriting expectations.
- Keep each test's inputs, action, and expected results easy to read together.
  Prefer explicit examples and modest duplication over shared fixtures,
  loops, or helpers that hide what the scenario proves.
- Prefer real dependencies when practical, then maintained fakes at the
  lowest external boundary. Check a fake against the real API's contract
  (ideally with shared contract tests); retain integration coverage of the
  real implementation.
- In Python tests, inject the needed callable or dependency rather than
  replacing shared built-ins or module functions process-wide; unrelated
  code must keep its normal behaviour.
- Give tests isolated temporary paths and database namespaces, with explicit
  fixture setup and cleanup. Do not assume shared files or services are empty
  or safe from concurrent tests; use Bazel's test temporary directory where
  applicable.
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

## Code design and boundaries

- Use guard clauses and early returns to keep error handling near its check
  and the main path shallow. Extract a focused function when nested loops or
  branches obscure the operation.
- Add abstractions, extension points, parameters, and flags only for current
  requirements. Keep APIs as private as practical and avoid options whose
  callers always use the same value.
- Name booleans and flags positively (for example, `enabled` or `hasAccess`)
  and prefer positive conditions in `if`/`else` branches. Keep negative guard
  clauses when they make early exits clearer; avoid double negatives.
- Bazel generates outputs; do not commit generated files. `//:base_defs`
  generates CSS module `.d.ts` types.
- Write new code for JavaScript runtimes in TypeScript (`.ts`, or `.tsx`
  for JSX). Do not add hand-written `.js`, `.mjs`, or `.cjs` source files.
  Use the repository's TypeScript/Bazel rules to type-check sources and
  compile any required JavaScript.
- Code under `project/` should not import another project unless the logic
  is specific to that project (for example, the shared zemn.me API client).
  Put broadly reusable code in `ts/...` or another shared language root.
- For timezone-aware TypeScript calendar math, use `Temporal.ZonedDateTime`
  from `temporal-polyfill` rather than custom offset or `Intl.formatToParts`
  arithmetic.
