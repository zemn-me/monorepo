# Pulumi notes

GitHub Actions secret storage is GCP Secret Manager in `extreme-cycling-441523-a9`; the WIF provider uses project number `845702659200`.

When Pulumi seeds GCP Secret Manager values, prefer `secretDataWo` with `deletionPolicy: "ABANDON"` so secret material is not persisted in state and bootstrap versions survive code removal.
