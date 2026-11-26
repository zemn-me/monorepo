"""List the checksum-pinned registry packages from the emulator source archive."""
import json
import sys
import tarfile
import tomllib

lock_path = f"aws-emulator-{sys.argv[2]}/Cargo.lock"
with tarfile.open(sys.argv[1], "r|gz") as source:
    for member in source:
        if member.name == lock_path and member.isfile():
            with source.extractfile(member) as lock:
                packages = tomllib.loads(lock.read().decode())["package"]
            break
    else:
        raise ValueError(f"Missing {lock_path}")

registry = []
for package in packages:
    if "source" not in package:
        continue  # Workspace member, included in the pinned source archive.
    if package["source"] != "registry+https://github.com/rust-lang/crates.io-index":
        raise ValueError(f"Unsupported Cargo package source: {package['source']}")
    registry.append({key: package[key] for key in ("name", "version", "checksum")})
print(json.dumps(registry))
