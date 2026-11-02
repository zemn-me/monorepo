"""Render source files into annotated fenced code blocks in a README template."""

import argparse
import pathlib
import re
import shlex
from collections.abc import Sequence

FENCE = re.compile(
    r"^(?P<indent>[ \t]*)(?P<fence>`{3,}|~{3,})(?P<info>[^\n]*)\n"
    r"(?P<body>.*?)"
    r"^(?P=indent)(?P=fence)[ \t]*$",
    re.MULTILINE | re.DOTALL,
)


def _metadata(info: str) -> dict[str, list[str]]:
    tokens = shlex.split(info)
    metadata: dict[str, list[str]] = {}
    for token in tokens[1:]:
        key, separator, value = token.partition("=")
        if separator:
            metadata.setdefault(key, []).append(value)
    return metadata


def _display_info(info: str) -> str:
    """Remove renderer-only metadata from the published fence."""
    return re.sub(r"""[ \t]+replace=(?:"[^"]*"|'[^']*'|\S+)""", "", info)


def render(template: str, examples: dict[str, str]) -> str:
    """Replace the contents of fences with their declared example source."""

    def replace(match: re.Match[str]) -> str:
        metadata = _metadata(match.group("info"))
        file_name = next(iter(metadata.get("file", [])), None)
        if file_name is None:
            return match.group(0)
        if file_name not in examples:
            raise ValueError(f"no example input matches {file_name!r}")
        source = examples[file_name].rstrip("\n")
        for replacement in metadata.get("replace", []):
            old, separator, new = replacement.partition(":")
            if not separator:
                raise ValueError(f"invalid replacement metadata: {replacement!r}")
            source = source.replace(old, new)
        display_info = _display_info(match.group("info"))
        return (
            f"{match.group('indent')}{match.group('fence')}{display_info}\n"
            f"{source}\n"
            f"{match.group('indent')}{match.group('fence')}"
        )

    return FENCE.sub(replace, template)


def _example_map(paths: Sequence[pathlib.Path]) -> dict[str, str]:
    examples: dict[str, str] = {}
    for path in paths:
        parts = path.parts
        try:
            relative = pathlib.PurePosixPath(*parts[parts.index("examples") :])
        except ValueError as error:
            raise ValueError(f"example is not beneath an examples directory: {path}") from error
        key = str(relative)
        if key in examples:
            raise ValueError(f"duplicate example path: {key}")
        examples[key] = path.read_text()
    return examples


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--template", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument("--example", type=pathlib.Path, action="append", default=[])
    args = parser.parse_args()
    rendered = render(args.template.read_text(), _example_map(args.example))
    args.output.write_text(rendered)
