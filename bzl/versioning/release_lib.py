import argparse
import hashlib
import json
from pathlib import Path

KINDS = ("api", "dependencies", "package")


def digest(files: list[str]) -> str:
    value = hashlib.sha256()
    for filename in sorted(files):
        path = Path(filename)
        value.update(path.name.encode())
        value.update(b"\0")
        value.update(path.read_bytes())
        value.update(b"\0")
    return value.hexdigest()


def read_version(paths: list[str]) -> list[int]:
    return [int(Path(path).read_text().strip()) for path in paths]


def write_manifest(args: argparse.Namespace) -> None:
    document = {
        "version": read_version(args.version),
        **{kind: digest(getattr(args, kind)) for kind in KINDS},
    }
    Path(args.out).write_text(json.dumps(document, indent=2, sort_keys=True) + "\n")


def changed_kind(old: dict[str, object], new: dict[str, object]) -> str | None:
    return next((kind for kind in KINDS if old.get(kind) != new.get(kind)), None)


def check(args: argparse.Namespace) -> None:
    old = json.loads(Path(args.lock).read_text())
    new = json.loads(Path(args.manifest).read_text())
    kind = changed_kind(old, new)
    if kind:
        raise SystemExit(f"{kind} changed; run the corresponding .fix target")


def fix(args: argparse.Namespace) -> None:
    lock_path = Path(args.lock)
    old = json.loads(lock_path.read_text()) if lock_path.exists() else {}
    new = json.loads(Path(args.manifest).read_text())
    kind = changed_kind(old, new)
    if kind:
        component = KINDS.index(kind)
        old_version = old.get("version", [-1, -1, -1])
        current_version = read_version(args.version)
        if current_version[component] <= old_version[component]:
            version_path = Path(args.version[component])
            version_path.write_text(f"{current_version[component] + 1}\n")
            current_version[component] += 1
        new["version"] = current_version
    lock_path.write_text(json.dumps(new, indent=2, sort_keys=True) + "\n")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser()
    commands = result.add_subparsers(required=True)
    manifest = commands.add_parser("manifest")
    manifest.add_argument("--out", required=True)
    manifest.add_argument("--version", nargs=3, required=True)
    for kind in KINDS:
        manifest.add_argument(f"--{kind}", nargs="+", required=True)
    manifest.set_defaults(run=write_manifest)
    for name, run in (("check", check), ("fix", fix)):
        command = commands.add_parser(name)
        command.add_argument("--manifest", required=True)
        command.add_argument("--lock", required=True)
        if name == "fix":
            command.add_argument("--version", nargs=3, required=True)
        command.set_defaults(run=run)
    return result
