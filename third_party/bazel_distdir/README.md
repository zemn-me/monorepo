# Bazel dependency download fallback

These are unchanged upstream source release archives, not Bazel build outputs.
GitLab ARM outages prevent both presubmit and staging from fetching them.
Bazel checks each archive against the integrity recorded in its registry.

| Module | Release | Registry metadata |
| --- | --- | --- |
| ape | 1.0.1 | https://bcr.bazel.build/modules/ape/1.0.1/source.json |
| rules_diff | 1.0.0 | https://bcr.bazel.build/modules/rules_diff/1.0.0/source.json |

Both URLs end in `src.tar.gz`, so each module has a separate distdir.
Staging copies the candidate archives to the runner temporary directory before
building main, allowing the fallback to bootstrap before it has merged.
The archives contain their upstream licenses. Remove the fallback when a reliable
upstream or checksum-identical public mirror is available.
