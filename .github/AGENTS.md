# GitHub Actions notes

CI secrets live in GCP Secret Manager via GitHub OIDC/WIF. Do not assume Azure Key Vault for this repo.

Presubmit gets only the read-only BuildBuddy key; staging and submit get the full key.

Staging and Submit share `pulumi_deploy`; obsolete pending merge-group runs are
removed by `cancel-obsolete-staging.yml`. Keep cleanup outside that concurrency
group and execute only trusted workflow code when using its Actions write token.

`package.json#packageManager` is the pnpm pin for both Renovate and Bazel. Do not
add pnpm as an npm dependency: Renovate gives dependency upgrades precedence over
that pin when generating lockfiles. The workflow reads Renovate's version from
the tested devDependency; keep the compatibility test on its real artifact path.
