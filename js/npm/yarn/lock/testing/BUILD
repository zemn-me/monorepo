load("//js/npm/yarn/lock:rules.bzl", "lockfile_minimize")
load("@bazel_skylib//rules:diff_test.bzl", "diff_test")

# everything will be pruned since the package.json is empty
lockfile_minimize(
    name = "minimized_lock_file",
    lockfile = "yarn.lock.example.txt",
    lockfile_out = "yarn.lock",
    package_json = "package.template.json",
)

diff_test(
    name = "test_expected_yarn_lock",
    file1 = "yarn.lock",
    file2 = "yarn.lock.expected.golden",
)
