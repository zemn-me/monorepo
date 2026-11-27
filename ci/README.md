CI
--

For more detail, it's best to read [presubmit.yml].

[presubmit.yml]: /.github/workflows/presubmit.yml

Pull requests run Bazel tests sized `small` or `medium` and build only the
targets those tests need. The merge queue builds and tests `//...` across all
sizes on the combined commit, including the deployment bundle and its smoke test.
Both stages run the Go module and Gazelle checks. After they pass, the merge-group
Presubmit publishes its bundle for Staging to deploy from that exact run.

The merge queue repeats the Tiberian Sun browser integration test five times through
`ci-local` (also inherited by both remote CI profiles). Every run must pass;
automatic test retries are disabled. The BEP annotator emits an error for any
`FLAKY` summary, which the presubmit runner treats as a failure even if Bazel
exits successfully.

Repeated runs increase the chance of detecting races; they cannot prove a test
is deterministic. For new browser or network tests, repeat the affected target
with `--runs_per_test=20 --nocache_test_results` before review, wait for observable
readiness before input, and control simulation time while keeping real network
I/O asynchronous. Extend the presubmit repetition filter to other targets that
need sustained coverage.
