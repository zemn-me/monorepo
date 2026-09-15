import base64
import hashlib
import unittest

from py.ci.post_upgrade.integrity import update_module_bazel_text


class TestAutoIntegrity(unittest.TestCase):
    archive = '''VERSION = "v1"
http_archive(
    name = "archive",
    integrity = "sha256-existing",
    # auto-integrity
    url = "https://example.com/" + VERSION + ".tar.gz",
)
'''

    def test_unchanged_archive_does_not_require_network(self):
        def fetcher(url):
            self.fail(f"Unchanged archive was fetched: {url}")
        self.assertEqual(
            update_module_bazel_text(self.archive, fetcher, self.archive),
            self.archive,
        )

    def test_changed_archive_url_is_refreshed_on_retries(self):
        updated = self.archive.replace('VERSION = "v1"', 'VERSION = "v2"')
        fetched = []
        def fetcher(url):
            fetched.append(url)
            return b"archive content"
        result = update_module_bazel_text(updated, fetcher, self.archive)
        self.assertNotIn("sha256-existing", result)
        self.assertEqual(fetched, ["https://example.com/v2.tar.gz"])
        self.assertEqual(update_module_bazel_text(result, fetcher, self.archive), result)
        self.assertEqual(len(fetched), 2)

    def test_new_archive_is_fetched_with_baseline(self):
        fetched = []
        def fetcher(url):
            fetched.append(url)
            return b"new archive"
        baseline = self.archive.replace('name = "archive"', 'name = "other"')
        result = update_module_bazel_text(self.archive, fetcher, baseline)
        self.assertNotIn("sha256-existing", result)
        self.assertEqual(fetched, ["https://example.com/v1.tar.gz"])

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


if __name__ == "__main__":
    unittest.main()
