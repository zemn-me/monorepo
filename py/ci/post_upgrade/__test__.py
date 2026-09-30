import base64
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import tempfile
import unittest

from py.ci.post_upgrade.integrity import update_module_bazel_text
from py.ci.post_upgrade.pnpm import refresh


class TestPnpmIntegrity(unittest.TestCase):
    def test_new_release_and_cached_release(self):
        with tempfile.TemporaryDirectory() as tmp:
            manifest, lock = Path(tmp) / "package.json", Path(tmp) / "integrity.json"
            manifest.write_text('{"packageManager":"pnpm@10.34.5"}')
            lock.write_text('{"version":"10.22.0","integrity":"old"}')
            integrity = "sha512-" + base64.b64encode(hashlib.sha512(b"release").digest()).decode()
            calls = []

            def fetcher(version):
                calls.append(version)
                return {"name": "pnpm", "version": version, "dist": {"integrity": integrity}}

            refresh(manifest, lock, fetcher)
            self.assertEqual(json.loads(lock.read_text()), {"version": "10.34.5", "integrity": integrity})
            refresh(manifest, lock, fetcher)
            self.assertEqual(calls, ["10.34.5"])

    def test_bad_metadata_preserves_reviewed_lock(self):
        integrity = "sha512-" + base64.b64encode(hashlib.sha512(b"release").digest()).decode()
        for metadata in [
            {"name": "other", "version": "10.34.5", "dist": {"integrity": integrity}},
            {"name": "pnpm", "version": "10.22.0", "dist": {"integrity": integrity}},
            {"name": "pnpm", "version": "10.34.5", "dist": {"integrity": "sha512-short"}},
        ]:
            with self.subTest(metadata=metadata), tempfile.TemporaryDirectory() as tmp:
                manifest, lock = Path(tmp) / "package.json", Path(tmp) / "integrity.json"
                manifest.write_text('{"packageManager":"pnpm@10.34.5"}')
                original = '{"version":"10.22.0","integrity":"reviewed"}'
                lock.write_text(original)
                with self.assertRaises(ValueError):
                    refresh(manifest, lock, lambda _: metadata)
                self.assertEqual(lock.read_text(), original)


class TestAutoIntegrity(unittest.TestCase):
    def test_multiline_build_content_does_not_end_archive(self):
        module = '''# http_archive(ignored comment
TEXT = "http_archive(ignored string"
http_archive(
    name = "sapling",
    build_file_content = """
filegroup(
    name = "srcs",
    srcs = glob(["**"], exclude = ["BUILD"]),
)
# http_archive(another ignored comment inside the string)
""",
    sha256 = "stale",
    # auto-integrity
    url = "https://example.com/sapling.tar.gz",
)
'''
        calls = []

        def fetcher(url):
            calls.append(url)
            return b"sapling release"

        updated = update_module_bazel_text(module, fetcher)
        self.assertEqual(calls, ["https://example.com/sapling.tar.gz"])
        self.assertEqual(updated, module.replace('sha256 = "stale"', f'sha256 = "{hashlib.sha256(b"sapling release").hexdigest()}"'))
        self.assertEqual(update_module_bazel_text(updated, fetcher, updated), updated)
        self.assertEqual(len(calls), 1)

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

    def test_only_changed_urls_are_downloaded(self):
        baseline = '''
VERSION = "1"
http_archive(
    name = "changed",
    sha256 = "old",
    # auto-integrity
    url = "https://example.com/" + VERSION + ".zip",
)
http_archive(
    name = "unavailable",
    sha256 = "keep-reviewed-checksum",
    # auto-integrity
    url = "https://example.com/removed-release.zip",
)
'''
        calls = []

        def fetcher(url):
            calls.append(url)
            self.assertEqual(url, "https://example.com/2.zip")
            return b"new release"

        updated = update_module_bazel_text(baseline.replace('VERSION = "1"', 'VERSION = "2"'), fetcher, baseline)
        self.assertEqual(calls, ["https://example.com/2.zip"])
        self.assertIn(hashlib.sha256(b"new release").hexdigest(), updated)
        self.assertIn('sha256 = "keep-reviewed-checksum"', updated)
        self.assertEqual(update_module_bazel_text(updated, fetcher, updated), updated)
        self.assertEqual(len(calls), 1)

    def test_malformed_marker_fails_instead_of_silently_skipping_repair(self):
        with self.assertRaisesRegex(Exception, "auto-integrity must be followed"):
            update_module_bazel_text('''http_archive(
    name = "broken",
    sha256 = "old",
    # auto-integrity
    strip_prefix = "wrong-order",
    url = "https://example.com/file.zip",
)
''', lambda _: b"data")

    def test_shell_bootstrap_repairs_before_bazel_and_stops_on_failure(self):
        # Exercise the actual entry point without fetching dependencies or
        # needing Bazel to load a repository with a deliberately stale hash.
        for available in [True, False]:
            with self.subTest(available=available), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                (root / "sh/bin").mkdir(parents=True)
                (root / "py/ci/post_upgrade").mkdir(parents=True)
                shutil.copyfile("sh/postUpgrade.sh", root / "sh/postUpgrade.sh")
                shutil.copyfile(Path(__file__).with_name("integrity.py"), root / "py/ci/post_upgrade/integrity.py")
                shutil.copyfile(Path(__file__).with_name("pnpm.py"), root / "py/ci/post_upgrade/pnpm.py")
                (root / "bzl/pnpm").mkdir(parents=True)
                (root / "package.json").write_text('{"packageManager":"pnpm@10.34.5"}')
                (root / "bzl/pnpm/integrity.json").write_text(json.dumps({
                    "version": "10.34.5",
                    "integrity": "sha512-" + base64.b64encode(hashlib.sha512(b"release").digest()).decode(),
                }))
                payload = root / "release.zip"
                if available:
                    payload.write_bytes(b"release bytes")
                baseline = f'''http_archive(
    name = "tool",
    sha256 = "stale",
    # auto-integrity
    url = "{payload.as_uri()}.old",
)
'''
                current = baseline.replace(payload.as_uri() + ".old", payload.as_uri())
                (root / "baseline").write_text(baseline)
                (root / "MODULE.bazel").write_text(current)
                (root / "bin").mkdir()
                (root / "bin/python3").symlink_to(sys.executable)
                git = root / "bin/git"
                git.write_text(f"#!/bin/sh\ncat {shlex.quote(str(root / 'baseline'))}\n")
                git.chmod(0o755)
                bazel = root / "sh/bin/bazel"
                bazel.write_text("#!/bin/sh\ncp MODULE.bazel observed-by-bazel\n")
                bazel.chmod(0o755)
                result = subprocess.run(
                    ["bash", str(root / "sh/postUpgrade.sh")], cwd=tmp,
                    env={**os.environ, "PATH": str(root / "bin") + os.pathsep + os.environ["PATH"]},
                    capture_output=True, text=True,
                )
                if available:
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertIn(hashlib.sha256(b"release bytes").hexdigest(), (root / "observed-by-bazel").read_text())
                else:
                    self.assertNotEqual(result.returncode, 0)
                    self.assertFalse((root / "observed-by-bazel").exists())
                    self.assertEqual((root / "MODULE.bazel").read_text(), current)


if __name__ == "__main__":
    unittest.main()
