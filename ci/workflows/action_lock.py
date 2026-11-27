"""Refresh the archive checksums for the external actions used in deployment tests."""

import argparse
from hashlib import file_digest
import json
import os
from pathlib import Path
import re
from urllib.request import urlopen

import yaml


def action_pins(root: Path) -> set[str]:
    pending = [
        root / ".github/workflows" / f"{name}.yml"
        for name in ("presubmit", "staging", "staging-pr", "submit")
    ]
    visited = set()
    pins = set()
    while pending:
        path = pending.pop()
        if path in visited:
            continue
        visited.add(path)
        document = yaml.safe_load(path.read_text())
        for group in [document.get("runs", {}), *document.get("jobs", {}).values()]:
            for step in group.get("steps", []):
                uses = step.get("uses")
                if not uses:
                    continue
                if uses.startswith("./"):
                    directory = root / uses
                    manifest = directory / "action.yml"
                    pending.append(manifest if manifest.exists() else directory / "action.yaml")
                    continue
                pin = re.fullmatch(r"([\w.-]+/[\w.-]+)(?:/[^@]+)?@([0-9a-f]{40})", uses, re.ASCII)
                if not pin:
                    raise ValueError(f"{path}: expected a GitHub action pinned by commit, got {uses}")
                pins.add(f"{pin[1]}@{pin[2]}")
    return pins


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        root = Path(os.environ["TEST_SRCDIR"]) / os.environ["TEST_WORKSPACE"]
    else:
        root = Path(os.environ["BUILD_WORKSPACE_DIRECTORY"])

    path = root / "ci/workflows/actions.lock.json"
    previous = json.loads(path.read_text())
    pins = action_pins(root)
    if args.check:
        if pins != previous.keys():
            raise SystemExit(
                f"Action pins differ: {sorted(pins ^ previous.keys())}. "
                "Run ./sh/bin/bazel run //ci/workflows:action_lock"
            )
        return

    lock = {}
    for pin in sorted(pins):
        if pin in previous:
            lock[pin] = previous[pin]
        else:
            repo, commit = pin.split("@")
            with urlopen(f"https://codeload.github.com/{repo}/zip/{commit}", timeout=60) as archive:
                lock[pin] = file_digest(archive, "sha256").hexdigest()
    path.write_text(json.dumps(lock, indent=2) + "\n")


if __name__ == "__main__":
    main()
