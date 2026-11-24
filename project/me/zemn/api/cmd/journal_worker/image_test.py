"""Check the packaged worker and its PATH tool against their Bazel executables."""

import hashlib
import json
import sys
import tarfile
from pathlib import Path


def check_image(layout: Path, binary: Path, ffmpeg: Path) -> None:
    def blob(descriptor: dict) -> Path:
        algorithm, digest = descriptor["digest"].split(":")
        return layout / "blobs" / algorithm / digest

    index = json.loads((layout / "index.json").read_text())
    (descriptor,) = index["manifests"]
    manifest = json.loads(blob(descriptor).read_text())
    config = json.loads(blob(manifest["config"]).read_text())
    assert config["config"]["Entrypoint"] == ["/journal_worker"]
    expected = {"journal_worker": binary, "usr/local/bin/ffmpeg": ffmpeg}
    for layer in reversed(manifest["layers"]):
        with tarfile.open(blob(layer)) as archive:
            for member in archive:
                path = member.name.removeprefix("./").lstrip("/")
                if path not in expected:
                    continue
                assert member.isfile() and member.mode & 0o111, path
                with (
                    expected.pop(path).open("rb") as source,
                    archive.extractfile(member) as packaged,
                ):
                    actual = hashlib.file_digest(packaged, "sha256").digest()
                    assert actual == hashlib.file_digest(source, "sha256").digest(), path
        if not expected:
            return
    raise AssertionError(f"missing image executables: {list(expected)}")


if __name__ == "__main__":
    check_image(*(Path(arg) for arg in sys.argv[1:]))
