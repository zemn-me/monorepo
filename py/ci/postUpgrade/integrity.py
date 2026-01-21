"""Helpers for post-upgrade routines."""
from __future__ import annotations

from typing import Callable
import base64
import hashlib
import re
import urllib.request


def _integrity_value(data: bytes) -> str:
    digest = hashlib.sha256(data).digest()
    return "sha256-" + base64.b64encode(digest).decode("utf-8")


def _sha256_value(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _resolve_expr(expr: str, var_values: dict[str, str]) -> str:
    parts = [part.strip() for part in expr.split("+")]
    out = ""
    for part in parts:
        if not part:
            continue
        if part.startswith("\"") and part.endswith("\""):
            out += part[1:-1]
        elif part in var_values:
            out += var_values[part]
        else:
            raise Exception(f"Unsupported URL token '{part}' in MODULE.bazel")
    return out


def _http_archive_blocks(module_text: str) -> list[tuple[int, int, str]]:
    blocks: list[tuple[int, int, str]] = []
    offset = 0
    while True:
        start = module_text.find("http_archive(", offset)
        if start == -1:
            break
        end_match = re.search(r"^\s*\)\s*$", module_text[start:], re.MULTILINE)
        if not end_match:
            raise Exception("Failed to find end of http_archive block")
        end = start + end_match.end()
        blocks.append((start, end, module_text[start:end]))
        offset = end
    return blocks


def _extract_archive_name(block: str) -> str:
    match = re.search(r"^\s*name\s*=\s*\"([^\"]+)\"", block, re.MULTILINE)
    if not match:
        raise Exception("Failed to find http_archive name")
    return match.group(1)


def _extract_url_expr(block: str) -> str:
    lines = block.splitlines()
    for idx, line in enumerate(lines):
        if line.strip().startswith("#") and "auto-integrity" in line:
            for follow_idx in range(idx + 1, len(lines)):
                follow = lines[follow_idx].strip()
                if not follow:
                    continue
                url_match = re.match(r"url\s*=\s*(.+?),\s*$", follow)
                if url_match:
                    return url_match.group(1).strip()
                if follow.startswith("urls") and follow.endswith("["):
                    for entry in lines[follow_idx + 1:]:
                        entry = entry.strip()
                        if "]" in entry:
                            break
                        if not entry or entry == ",":
                            continue
                        entry_match = re.match(r"(.+?),\s*$", entry)
                        if entry_match:
                            return entry_match.group(1).strip()
                    raise Exception("Failed to find urls entry after auto-integrity")
                raise Exception("auto-integrity must be followed by url or urls")
    raise Exception("Missing auto-integrity marker")


def _extract_checksum_field(block: str) -> str:
    if re.search(r"^\s*integrity\s*=", block, re.MULTILINE):
        return "integrity"
    if re.search(r"^\s*sha256\s*=", block, re.MULTILINE):
        return "sha256"
    raise Exception("Failed to find integrity or sha256 field")


def _replace_archive_field_in_block(
    block: str,
    archive_name: str,
    field: str,
    value: str,
) -> str:
    pattern = re.compile(
        rf"^(?P<indent>\s*){field}\s*=\s*\"[^\"]*\"(?P<comma>,?)\s*$",
        re.MULTILINE,
    )
    match = pattern.search(block)
    if not match:
        raise Exception(f"Failed to find {field} for {archive_name} in MODULE.bazel")
    indent = match.group("indent")
    comma = match.group("comma")
    replacement = f"{indent}{field} = \"{value}\"{comma}"
    return block[:match.start()] + replacement + block[match.end():]


def update_module_bazel_text(
    module_text: str,
    fetcher: Callable[[str], bytes],
) -> str:
    var_values: dict[str, str] = {}
    for match in re.finditer(r"^([A-Z0-9_]+)\s*=\s*\"([^\"]+)\"", module_text, re.MULTILINE):
        var_values[match.group(1)] = match.group(2)

    updated = module_text
    blocks = _http_archive_blocks(module_text)
    for start, end, archive_block in reversed(blocks):
        try:
            url_expr = _extract_url_expr(archive_block)
        except Exception:
            continue
        archive_name = _extract_archive_name(archive_block)
        field = _extract_checksum_field(archive_block)
        url = _resolve_expr(url_expr, var_values)
        data = fetcher(url)
        value = _sha256_value(data) if field == "sha256" else _integrity_value(data)
        updated_block = _replace_archive_field_in_block(
            archive_block,
            archive_name,
            field,
            value,
        )
        updated = updated[:start] + updated_block + updated[end:]
    return updated


def _fetch_url(url: str) -> bytes:
    with urllib.request.urlopen(url) as response:
        return response.read()


def update_git_refs_archives_file(module_bazel: str) -> None:
    text = open(module_bazel, "r", encoding="utf-8").read()
    updated = update_module_bazel_text(text, _fetch_url)
    with open(module_bazel, "w", encoding="utf-8") as handle:
        handle.write(updated)
