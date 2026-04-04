import base64
import hashlib
import unittest

from py.ci.post_upgrade.integrity import update_module_bazel_text


class TestAutoIntegrity(unittest.TestCase):
    def test_updates_auto_integrity_archives(self):
        module_text = """
FOO_COMMIT = "abc123"
BAR_COMMIT = "def456"
BAZELISH_VERSION = "1.2.3+meta"

http_archive(
    name = "foo",
    integrity = "sha256-old",
    strip_prefix = "foo-" + FOO_COMMIT,
    # auto-integrity
    url = "https://example.com/foo/" + FOO_COMMIT + ".zip",
)

http_archive(
    name = "bar",
    sha256 = "deadbeef",
    strip_prefix = "bar-" + BAR_COMMIT,
    # auto-integrity
    urls = [
        "https://example.com/bar/" + BAR_COMMIT + ".tar.gz",
    ],
)

http_archive(
    name = "nope",
    integrity = "sha256-unchanged",
    url = "https://example.com/nope.zip",
)

http_archive(
    name = "bazelish",
    sha256 = "badc0ffee",
    # auto-integrity
    url = "https://example.com/releases/" + BAZELISH_VERSION.replace("+", "%2B") + "/bazelish-" + BAZELISH_VERSION.replace("+", "-") + ".tar.gz",
)
""".lstrip()

        payloads = {
            "https://example.com/foo/abc123.zip": b"foo-data",
            "https://example.com/bar/def456.tar.gz": b"bar-data",
            "https://example.com/releases/1.2.3%2Bmeta/bazelish-1.2.3-meta.tar.gz": b"bazelish-data",
        }

        def fetcher(url: str) -> bytes:
            return payloads[url]

        updated = update_module_bazel_text(module_text, fetcher)

        foo_integrity = "sha256-" + base64.b64encode(
            hashlib.sha256(payloads["https://example.com/foo/abc123.zip"]).digest()
        ).decode("utf-8")
        bar_sha256 = hashlib.sha256(payloads["https://example.com/bar/def456.tar.gz"]).hexdigest()
        bazelish_sha256 = hashlib.sha256(
            payloads["https://example.com/releases/1.2.3%2Bmeta/bazelish-1.2.3-meta.tar.gz"]
        ).hexdigest()

        self.assertIn(f'integrity = "{foo_integrity}"', updated)
        self.assertIn(f'sha256 = "{bar_sha256}"', updated)
        self.assertIn(f'sha256 = "{bazelish_sha256}"', updated)
        self.assertIn('integrity = "sha256-unchanged"', updated)

    def test_updates_archive_after_multiline_build_file(self):
        module_text = '''
SAPLING_VERSION = "0.2.20260317-201835+0234c21f"

http_archive(
    name = "sapling_linux_amd64",
    build_file_content = """
package(default_visibility = ["//visibility:public"])

filegroup(
    name = "srcs",
    srcs = glob(["**"]),
)
""",
    sha256 = "old",
    strip_prefix = "sapling-" + SAPLING_VERSION.replace("+", "-"),
    # auto-integrity
    url = "https://example.com/sapling/" + SAPLING_VERSION + ".tar.gz",
)
'''.lstrip()

        payload = b"sapling-data"
        updated = update_module_bazel_text(
            module_text,
            lambda url: payload,
        )

        self.assertIn(
            f'sha256 = "{hashlib.sha256(payload).hexdigest()}"',
            updated,
        )


if __name__ == "__main__":
    unittest.main()
