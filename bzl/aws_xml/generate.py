"""Generate Go XML wire types from a selected AWS Smithy model."""

import argparse
import json
from pathlib import Path

from bzl.aws_xml.projection import generate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--prefix", required=True)
    parser.add_argument("--select", action="append", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.write_text(
        generate(json.loads(args.model.read_text()), args.prefix, args.select)
    )


if __name__ == "__main__":
    main()
