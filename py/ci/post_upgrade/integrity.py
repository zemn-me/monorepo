"""Helpers for post-upgrade routines."""
from __future__ import annotations

from typing import Callable
import argparse
import base64
import hashlib
import io
from pathlib import Path
import re
import subprocess
import tokenize
import urllib.request


def _integrity_value(data: bytes) -> str:
    digest = hashlib.sha256(data).digest()
    return "sha256-" + base64.b64encode(digest).decode("utf-8")


def _sha256_value(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _split_concat_expr(expr: str) -> list[str]:
    parts: list[str] = []
    current: list[str] = []
    in_string = False
    escape = False
    paren_depth = 0

    for ch in expr:
        if escape:
            current.append(ch)
            escape = False
            continue
        if ch == "\\" and in_string:
            current.append(ch)
            escape = True
            continue
        if ch == "\"":
            current.append(ch)
            in_string = not in_string
            continue
        if not in_string:
            if ch == "(":
                paren_depth += 1
            elif ch == ")":
                paren_depth -= 1
            elif ch == "+" and paren_depth == 0:
                parts.append("".join(current).strip())
                current = []
                continue
        current.append(ch)

    if current:
        parts.append("".join(current).strip())
    return [part for part in parts if part]


def _resolve_token(token: str, var_values: dict[str, str]) -> str:
    if token.startswith("\"") and token.endswith("\""):
        return token[1:-1]
    if token in var_values:
        return var_values[token]

    replace_match = re.fullmatch(
        r'(?P<base>[A-Z0-9_]+|"(?:[^"\\]|\\.)*")\.replace\("(?P<old>(?:[^"\\]|\\.)*)",\s*"(?P<new>(?:[^"\\]|\\.)*)"\)',
        token,
    )
    if replace_match:
        base = _resolve_token(replace_match.group("base"), var_values)
        return base.replace(replace_match.group("old"), replace_match.group("new"))

    raise Exception(f"Unsupported URL token '{token}' in MODULE.bazel")


def _resolve_expr(expr: str, var_values: dict[str, str]) -> str:
    parts = _split_concat_expr(expr)
    out = ""
    for part in parts:
        out += _resolve_token(part, var_values)
    return out


def _http_archive_blocks(module_text: str) -> list[tuple[int, int, str]]:
    # Starlark strings can contain complete BUILD snippets, including closing
    # parentheses and apparent archive calls. Tokenization keeps those opaque.
    line_offsets = [0]
    for line in module_text.splitlines(keepends=True):
        line_offsets.append(line_offsets[-1] + len(line))

    def offset(position: tuple[int, int]) -> int:
        row, column = position
        return line_offsets[row - 1] + column

    blocks: list[tuple[int, int, str]] = []
    start: int | None = None
    depth = 0
    for token in tokenize.generate_tokens(io.StringIO(module_text).readline):
        if token.type in (tokenize.COMMENT, tokenize.NL, tokenize.NEWLINE):
            continue
        if depth:
            if token.type == tokenize.OP:
                if token.string == "(":
                    depth += 1
                elif token.string == ")":
                    depth -= 1
                    if depth == 0:
                        end = offset(token.end)
                        assert start is not None
                        blocks.append((start, end, module_text[start:end]))
                        start = None
        elif start is not None and token.type == tokenize.OP and token.string == "(":
            depth = 1
        else:
            start = offset(token.start) if token.type == tokenize.NAME and token.string == "http_archive" else None
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
    baseline: str | None = None,
) -> str:
    var_values: dict[str, str] = {}
    for match in re.finditer(r"^([A-Z0-9_]+)\s*=\s*\"([^\"]+)\"", module_text, re.MULTILINE):
        var_values[match.group(1)] = match.group(2)

    # Unchanged URLs keep their reviewed checksums. Fetching every archive can
    # block an unrelated update on an unavailable historical release.
    baseline_urls = _archive_urls(baseline) if baseline is not None else {}
    updated = module_text
    blocks = _http_archive_blocks(module_text)
    for start, end, archive_block in reversed(blocks):
        if "auto-integrity" not in archive_block:
            continue
        url_expr = _extract_url_expr(archive_block)
        archive_name = _extract_archive_name(archive_block)
        field = _extract_checksum_field(archive_block)
        url = _resolve_expr(url_expr, var_values)
        if baseline_urls.get(archive_name) == url:
            continue
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


def _archive_urls(module_text: str) -> dict[str, str]:
    variables = dict(re.findall(r'^([A-Z0-9_]+)\s*=\s*"([^"]+)"', module_text, re.MULTILINE))
    return {
        _extract_archive_name(block): _resolve_expr(_extract_url_expr(block), variables)
        for _, _, block in _http_archive_blocks(module_text)
        if "auto-integrity" in block
    }


def _fetch_url(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def update_git_refs_archives_file(module_bazel: str, baseline: str | None = None) -> None:
    text = open(module_bazel, "r", encoding="utf-8").read()
    updated = update_module_bazel_text(text, _fetch_url, baseline)
    with open(module_bazel, "w", encoding="utf-8") as handle:
        handle.write(updated)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Refresh changed archive checksums before starting Bazel.")
    parser.add_argument("module", type=Path)
    parser.add_argument("--baseline-ref", default="HEAD", help="Git revision before the dependency update")
    args = parser.parse_args()
    module = args.module.resolve()
    baseline = subprocess.check_output(
        ["git", "show", f"{args.baseline_ref}:{module.name}"],
        cwd=module.parent, text=True,
    )
    update_git_refs_archives_file(str(module), baseline)
