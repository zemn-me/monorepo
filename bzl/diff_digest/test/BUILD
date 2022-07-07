load("//bzl/diff_digest:rules.bzl", "diff_digest")
load("@bazel_skylib//rules:diff_test.bzl", "diff_test")

diff_digest(
   name = "digest",
   srcs = glob([ "test_files/**/*" ]),
   output = "digest.diff"
)

diff_test(
   name = "digest_correct",
   file1 = "digest.diff",
   file2 = "digest_golden.diff"
)
