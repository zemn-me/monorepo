"""Check the runnable OCI artifact that is both tested and published to ECS."""

import json
import re
import sys
from pathlib import Path


def blob(layout: Path, descriptor: dict) -> dict:
    algorithm, digest = descriptor["digest"].split(":", 1)
    return json.loads((layout / "blobs" / algorithm / digest).read_text())


layout = Path(sys.argv[1])
index = json.loads((layout / "index.json").read_text())
manifest = blob(layout, index["manifests"][0])
config = blob(layout, manifest["config"])
assert config["os"] == "linux"
assert config["architecture"] == "amd64", "Image must match ECS's CPU architecture"
environment = dict(value.split("=", 1) for value in config["config"]["Env"])
configured = dict(line.split("=", 1) for line in Path(sys.argv[3]).read_text().splitlines())
assert environment["VERSION"] == configured["VERSION"], (
    "The deployable image must embed the Renovate-managed Minecraft version"
)
assert re.fullmatch(r"\d+\.\d+(?:\.\d+)?", environment["VERSION"]), (
    "Minecraft must use an explicit release, never LATEST or SNAPSHOT"
)
base = Path(sys.argv[2])
base_index = json.loads((base / "index.json").read_text())
base_manifest = blob(base, base_index["manifests"][0])
base_config = blob(base, base_manifest["config"])
assert config["config"]["Entrypoint"] == base_config["config"]["Entrypoint"], (
    "Preserve the upstream launcher that configures Minecraft and emits server logs"
)

assert manifest["layers"] == base_manifest["layers"], "Preserve upstream server binaries"
