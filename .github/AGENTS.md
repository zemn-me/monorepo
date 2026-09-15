# GitHub Actions notes

CI secrets live in GCP Secret Manager via GitHub OIDC/WIF. Do not assume Azure Key Vault for this repo.

Presubmit gets only the read-only BuildBuddy key; staging and submit get the full key.

Staging and Submit share `pulumi_deploy`; obsolete pending merge-group runs are
removed by `cancel-obsolete-staging.yml`. Keep cleanup outside that concurrency
group and execute only trusted workflow code through Bazel when using its Actions
write token. Cleanup also cancels obsolete running Presubmits, which only run checks.
