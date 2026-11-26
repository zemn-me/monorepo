"""Build the patched Linux emulator offline from Bazel-verified Cargo inputs."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def main():
    source, output, cargo, rustc, rustdoc, patch, *crates = (
        Path(argument).absolute() for argument in sys.argv[1:]
    )
    with tempfile.TemporaryDirectory() as directory:
        work = Path(directory)
        src = work / "source"
        src.mkdir()
        subprocess.run(["tar", "-xzf", source, "--strip-components=1", "-C", src], check=True)
        subprocess.run(["patch", "--batch", "--fuzz=0", "-p1", "-i", patch], cwd=src, check=True)
        vendor = work / "vendor"
        vendor.mkdir()
        for archive in crates:
            subprocess.run(["tar", "-xzf", archive, "-C", vendor], check=True)
            with archive.open("rb") as package:
                checksum = hashlib.file_digest(package, "sha256").hexdigest()
            (vendor / archive.stem / ".cargo-checksum.json").write_text(
                json.dumps({"package": checksum, "files": {}})
            )
        cargo_home = work / "cargo"
        cargo_home.mkdir()
        (cargo_home / "config.toml").write_text(
            '[source.crates-io]\nreplace-with = "vendored"\n[source.vendored]\n'
            f'directory = {json.dumps(str(vendor))}\n'
        )
        env = dict(
            os.environ,
            CARGO_HOME=str(cargo_home),
            RUSTC=str(rustc),
            RUSTDOC=str(rustdoc),
            # Use the Linux C linker for Cargo build scripts and the router.
            RUSTFLAGS="-C linker=cc -C link-self-contained=no -C linker-features=-lld",
            CARGO_INCREMENTAL="0",
            CARGO_PROFILE_DEV_DEBUG="0",
            CARGO_PROFILE_DEV_STRIP="symbols",
            CARGO_BUILD_JOBS="4",
        )
        subprocess.run(
            [cargo, "build", "--frozen", "-p", "aws-emulator-router", "--bin", "aws-emulator"],
            cwd=src,
            env=env,
            check=True,
        )
        shutil.copy2(src / "target/debug/aws-emulator", output)


if __name__ == "__main__":
    main()
