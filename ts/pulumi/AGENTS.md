# Pulumi notes

GitHub Actions secret storage is GCP Secret Manager in `extreme-cycling-441523-a9`; the WIF provider uses project number `845702659200`.

When Pulumi seeds GCP Secret Manager values, prefer `secretDataWo` with `deletionPolicy: "ABANDON"` so secret material is not persisted in state and bootstrap versions survive code removal.

After migration, protect the GCP WIF and Secret Manager resources that CI requires; only leave them unprotected during an explicit rollback window.

The AWS GitHub Actions role is intentionally admin for now, but its trust policy must stay pinned to the Submit workflow on `refs/heads/main` and the Staging workflow on merge-queue refs.

AWS GitHub OIDC trust policies should use AWS-documented GitHub keys like `repository_id`, `workflow`, `ref`, and `sub`; do not copy GCP-only owner claim checks into AWS.
