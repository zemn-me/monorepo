"""Refresh the pnpm tool integrity before Bazel loads the selected release."""

import base64
import json
from pathlib import Path
import re
import urllib.request


def registry_metadata(version: str) -> dict:
    with urllib.request.urlopen(f"https://registry.npmjs.org/pnpm/{version}", timeout=30) as response:
        return json.load(response)


def validate_integrity(integrity: str) -> None:
    if not integrity.startswith("sha512-") or len(base64.b64decode(integrity[7:], validate=True)) != 64:
        raise ValueError("pnpm must have a valid SHA-512 registry integrity")


def refresh(manifest_path: Path, lock_path: Path, fetcher=registry_metadata) -> None:
    package_manager = json.loads(manifest_path.read_text())["packageManager"]
    match = re.fullmatch(r"pnpm@(\d+\.\d+\.\d+)", package_manager)
    if not match:
        raise ValueError("packageManager must pin an exact pnpm release")
    version = match[1]
    if lock_path.exists():
        locked = json.loads(lock_path.read_text())
        if locked.get("version") == version:
            validate_integrity(locked["integrity"])
            return
    metadata = fetcher(version)
    if metadata.get("name") != "pnpm" or metadata.get("version") != version:
        raise ValueError("Registry metadata does not match the requested pnpm release")
    integrity = metadata["dist"]["integrity"]
    validate_integrity(integrity)
    lock_path.write_text(json.dumps({"version": version, "integrity": integrity}, indent=2) + "\n")


if __name__ == "__main__":
    refresh(Path("package.json"), Path("bzl/pnpm/integrity.json"))
