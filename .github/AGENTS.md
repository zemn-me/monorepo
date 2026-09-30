# GitHub Actions notes

CI secrets live in GCP Secret Manager via GitHub OIDC/WIF. Do not assume Azure Key Vault for this repo.

Presubmit gets only the read-only BuildBuddy key; staging and submit get the full key.

Staging and Submit share `pulumi_deploy`; obsolete pending merge-group runs are
removed by `cancel-obsolete-staging.yml`. Keep cleanup outside that concurrency
group and execute only trusted workflow code through Bazel when using its Actions
write token. Cleanup also cancels obsolete running Presubmits, which only run checks.

Renovate's container entrypoint installs bootstrap tools as root, then runs the
bot as `ubuntu`. Keep post-upgrade checksum repair before Bazel and refresh stale
branches explicitly: merge queues make Renovate's automatic rebase policy leave
non-conflicting failed branches on old tooling.

Let `pip-compile` own `requirements.txt`; direct edits of transitive pins can
violate parent constraints. Its manager needs an explicit file pattern and a
pip-compile command in the generated header. Keep that header aligned with the
`CUSTOM_COMPILE_COMMAND` on the Bazel requirements target.
Keep supported lower bounds on direct Python dependencies; unbounded inputs
can resolve to obsolete tools to accommodate newer transitive packages.

`package.json#packageManager` pins pnpm for both Bazel and Renovate. Keep pnpm
out of dependency sections, which override Renovate's tool selection. The
workflow reads its Renovate version from the tested devDependency.
The pnpm bootstrap refreshes `bzl/pnpm/integrity.json` before Bazel starts,
so new pnpm releases do not depend on rules_js's bundled version table.
