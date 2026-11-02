CI
--

For more detail, it's best to read [presubmit.yml].

[presubmit.yml]: /.github/workflows/presubmit.yml

Presubmit repeats the Tiberian Sun browser integration test five times through
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
