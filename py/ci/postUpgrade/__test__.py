import base64
import hashlib
import unittest

from py.ci.postUpgrade.integrity import update_module_bazel_text


class TestAutoIntegrity(unittest.TestCase):
    def test_updates_auto_integrity_archives(self):
        module_text = """
FOO_COMMIT = "abc123"
BAR_COMMIT = "def456"

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
""".lstrip()

        payloads = {
            "https://example.com/foo/abc123.zip": b"foo-data",
            "https://example.com/bar/def456.tar.gz": b"bar-data",
        }

        def fetcher(url: str) -> bytes:
            return payloads[url]

        updated = update_module_bazel_text(module_text, fetcher)

        foo_integrity = "sha256-" + base64.b64encode(
            hashlib.sha256(payloads["https://example.com/foo/abc123.zip"]).digest()
        ).decode("utf-8")
        bar_sha256 = hashlib.sha256(payloads["https://example.com/bar/def456.tar.gz"]).hexdigest()

        self.assertIn(f'integrity = "{foo_integrity}"', updated)
        self.assertIn(f'sha256 = "{bar_sha256}"', updated)
        self.assertIn('integrity = "sha256-unchanged"', updated)


if __name__ == "__main__":
    unittest.main()
