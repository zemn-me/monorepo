"""Retain outgoing provider binaries for stacks still using their old checkpoints."""

import json
from pathlib import Path
import subprocess


def retain_checkpoint_versions(previous: dict, current: dict, path: Path) -> None:
    previous_sdk = previous["devDependencies"] | previous["dependencies"]
    current_sdk = current["devDependencies"] | current["dependencies"]
    retained = json.loads(path.read_text())
    for name, versions in retained.items():
        sdk = f"@pulumi/{name}"
        outgoing = previous_sdk.get(sdk)
        if outgoing and outgoing != current_sdk[sdk] and outgoing not in versions:
            versions.append(outgoing)
    path.write_text(json.dumps(retained, indent=2) + "\n")


if __name__ == "__main__":
    previous = subprocess.check_output(["git", "show", "HEAD:package.json"])
    retain_checkpoint_versions(
        json.loads(previous),
        json.loads(Path("package.json").read_text()),
        Path("bzl/pulumi_providers/checkpoint_versions.json"),
    )
