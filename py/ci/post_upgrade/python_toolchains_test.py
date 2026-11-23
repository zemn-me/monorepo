import json
import unittest

from py.ci.post_upgrade.python_toolchains import synchronize


def module(version="3.18.2"):
    return f'''# BEGIN default Python runtime archives
python.single_version_platform_override(
    platform = "x86_64-unknown-linux-gnu",
    python_version = "3.18.0",
    sha256 = "{'a' * 64}",
    strip_prefix = "python",
    urls = ["https://github.com/astral-sh/python-build-standalone/releases/download/20290101/cpython-3.18.0%2B20290101-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz"],
)
python.single_version_platform_override(
    platform = "aarch64-apple-darwin",
    python_version = "3.18.0",
    sha256 = "{'b' * 64}",
    strip_prefix = "python",
    urls = ["https://github.com/astral-sh/python-build-standalone/releases/download/20290101/cpython-3.18.0%2B20290101-aarch64-apple-darwin-install_only_stripped.tar.gz"],
)
# END default Python runtime archives
PYTHON_VERSION = "{version}"
'''


class ToolchainsTest(unittest.TestCase):
    def test_uses_newest_complete_publisher_release(self):
        sums = {
            "20290403": f"{'c'*64}  cpython-3.18.2+20290403-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz\n",
            "20290401": f"{'d'*64}  cpython-3.18.2+20290401-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz\n{'e'*64}  cpython-3.18.2+20290401-aarch64-apple-darwin-install_only_stripped.tar.gz\n",
        }
        def fetch(url):
            if "/tags?" in url:
                return json.dumps([{"name": "20290401"}, {"name": "20290403"}])
            return sums[url.split("/")[-2]]
        updated = synchronize(module(), fetch)
        self.assertNotIn('python_version = "3.18.0"', updated)
        self.assertEqual(updated.count('python_version = "3.18.2"'), 2)
        self.assertIn('sha256 = "' + 'd'*64 + '"', updated)
        self.assertIn('sha256 = "' + 'e'*64 + '"', updated)
        self.assertNotIn("20290403", updated)
        self.assertEqual(synchronize(updated, lambda _: self.fail("No network for aligned pins")), updated)

    def test_missing_platform_or_version_fails_closed(self):
        def fetch(url):
            if "/tags?" in url:
                return '[{"name":"20300101"}]'
            return f"{'c'*64}  cpython-3.19.2+20300101-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz\n"
        with self.assertRaisesRegex(ValueError, "No complete publisher release"):
            synchronize(module("3.19.2"), fetch)

    def test_rejects_unpinned_python_or_mismatched_platform_url(self):
        with self.assertRaisesRegex(ValueError, "exact PYTHON_VERSION"):
            synchronize(module("3.18"))
        with self.assertRaisesRegex(ValueError, "does not match"):
            synchronize(module().replace('platform = "aarch64-apple-darwin"', 'platform = "new-platform"'))

    def test_network_errors_propagate(self):
        def fetch(_):
            raise OSError("publisher unavailable")
        with self.assertRaises(OSError):
            synchronize(module(), fetch)


if __name__ == "__main__":
    unittest.main()
