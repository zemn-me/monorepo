"""Refresh publisher-pinned default Python runtimes before Bazel loads them."""

import json
from pathlib import Path
import re
from urllib.request import Request, urlopen


_PUBLISHER = "https://github.com/astral-sh/python-build-standalone"
_BEGIN = "# BEGIN default Python runtime archives"
_END = "# END default Python runtime archives"


def _fetch(url: str) -> str:
    request = Request(url, headers={"User-Agent": "monorepo-python-toolchains"})
    with urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8")


def _release(version: str, platforms: list[str], fetch):
    # Tags are lightweight; release API objects contain thousands of assets.
    tags = json.loads(fetch("https://api.github.com/repos/astral-sh/python-build-standalone/tags?per_page=100"))
    dates = sorted({tag["name"] for tag in tags if re.fullmatch(r"\d{8}", tag["name"])}, reverse=True)
    for date in dates:
        base = f"{_PUBLISHER}/releases/download/{date}/"
        sums = {}
        for line in fetch(base + "SHA256SUMS").splitlines():
            match = re.fullmatch(r"([0-9a-f]{64})\s+\*?(\S+)", line)
            if match:
                sums[match[2]] = match[1]
        assets = {platform: f"cpython-{version}+{date}-{platform}-install_only_stripped.tar.gz" for platform in platforms}
        if all(asset in sums for asset in assets.values()):
            return {platform: (base + asset.replace("+", "%2B"), sums[asset]) for platform, asset in assets.items()}
    raise ValueError(f"No complete publisher release for Python {version}: {', '.join(platforms)}")


def synchronize(module: str, fetch=_fetch) -> str:
    version_match = re.search(r'^PYTHON_VERSION\s*=\s*"(\d+\.\d+\.\d+)"', module, re.MULTILINE)
    if version_match is None:
        raise ValueError("Expected an exact PYTHON_VERSION")
    version = version_match[1]
    if module.count(_BEGIN) != 1 or module.count(_END) != 1:
        raise ValueError("Expected one managed default Python runtime region")
    before, region = module.split(_BEGIN)
    region, after = region.split(_END)
    blocks = list(re.finditer(r"python\.single_version_platform_override\(.*?\n\)", region, re.DOTALL))
    if not blocks:
        raise ValueError("Default Python runtime region has no platform overrides")
    platforms = []
    versions = []
    for match in blocks:
        block = match[0]
        platform = re.search(r'platform\s*=\s*"([^"]+)"', block)
        current = re.search(r'python_version\s*=\s*"([^"]+)"', block)
        if platform is None or current is None:
            raise ValueError("Malformed Python platform override")
        if 'strip_prefix = "python"' not in block or not re.search(r'sha256\s*=\s*"[0-9a-f]{64}"', block):
            raise ValueError("Expected checksum-pinned publisher Python archive")
        expected_url = re.escape(_PUBLISHER) + r'/releases/download/\d{8}/cpython-' + re.escape(current[1]) + r'%2B\d{8}-' + re.escape(platform[1]) + r'-install_only_stripped\.tar\.gz'
        if not re.search(expected_url, block):
            raise ValueError("Python override URL does not match its version and platform")
        platforms.append(platform[1])
        versions.append(current[1])
    if len(set(platforms)) != len(platforms):
        raise ValueError("Duplicate Python runtime platform")
    if all(current == version for current in versions):
        return module
    releases = _release(version, platforms, fetch)
    # Resolve every platform first, so failures leave the checked-in file intact.
    for match, platform in reversed(list(zip(blocks, platforms))):
        url, sha256 = releases[platform]
        block = re.sub(r'python_version\s*=\s*"[^"]+"', f'python_version = "{version}"', match[0])
        block = re.sub(r'sha256\s*=\s*"[^"]+"', f'sha256 = "{sha256}"', block)
        block = re.sub(r'urls\s*=\s*\["[^"]+"\]', f'urls = ["{url}"]', block)
        region = region[:match.start()] + block + region[match.end():]
    return before + _BEGIN + region + _END + after


if __name__ == "__main__":
    path = Path("MODULE.bazel")
    path.write_text(synchronize(path.read_text()))
