"""Compare every shipped output of two independent, full engine compilations."""

import argparse
import hashlib
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--first", nargs=3, required=True)
    parser.add_argument("--second", nargs=3, required=True)
    args = parser.parse_args()
    first_outputs = sorted(args.first)
    second_outputs = sorted(args.second)
    assert len(first_outputs) == len(second_outputs) == 3, "Expected JS, WASM, and data outputs"
    failures = []
    for first, second in zip(first_outputs, second_outputs, strict=True):
        original, rebuilt = Path(first), Path(second)
        left, right = original.read_bytes(), rebuilt.read_bytes()
        if not left or left != right:
            failures.append(
                f"{original.name}: independent compilations differ or are empty\n"
                f"  {original}: {hashlib.sha256(left).hexdigest()} ({len(left)} bytes)\n"
                f"  {rebuilt}: {hashlib.sha256(right).hexdigest()} ({len(right)} bytes)"
            )
    if failures:
        raise AssertionError("\n".join(failures))


if __name__ == "__main__":
    main()
