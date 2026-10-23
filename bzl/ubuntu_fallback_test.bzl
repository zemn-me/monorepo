load("@bazel_skylib//lib:unittest.bzl", "asserts", "unittest")
load("@rules_distroless//apt/private:deb_import.bzl", "deb_package_urls")

def _policy_test_impl(ctx):
    env = unittest.begin(ctx)
    snapshot = "https://snapshot.ubuntu.com/ubuntu/20261001T000000Z/pool/main/a/a/a_1_amd64.deb"
    archive = "https://archive.ubuntu.com/ubuntu/pool/main/a/a/a_1_amd64.deb"
    digest = "a" * 64
    asserts.equals(env, [snapshot, archive], deb_package_urls([snapshot], digest))
    asserts.equals(env, [snapshot, archive], deb_package_urls([snapshot, archive], digest))
    for invalid_digest in ["", "a" * 63, "g" * 64]:
        asserts.equals(env, [snapshot], deb_package_urls([snapshot], invalid_digest))
    for other in [
        snapshot.replace("https://", "http://"),
        snapshot.replace("snapshot.ubuntu.com", "snapshot.ubuntu.com.example"),
        snapshot.replace("20261001T000000Z", "latest"),
        snapshot.replace("20261001T000000Z", "xxxxxxxxTxxxxxxZ"),
        snapshot.replace("pool/main/a/a/a_1_amd64.deb", "dists/jammy/main/binary-amd64/Packages"),
        snapshot + "?download=1",
        snapshot + "#fragment",
        snapshot.replace("/main/", "/../"),
        snapshot.replace("/main/", "/%2e%2e/"),
    ]:
        asserts.equals(env, [other], deb_package_urls([other], digest))
    return unittest.end(env)

_policy_test = unittest.make(_policy_test_impl)

def ubuntu_fallback_test_suite(name):
    unittest.suite(name, _policy_test)
