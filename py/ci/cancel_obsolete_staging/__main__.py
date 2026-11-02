"""Run with the GitHub Actions token; default to a read-only preview."""

import argparse
import os

from py.ci.cancel_obsolete_staging import GitHub, cleanup


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    cleanup(
        GitHub(
            os.environ["GITHUB_REPOSITORY"],
            os.environ["GH_TOKEN"],
            os.environ.get("GITHUB_API_URL", "https://api.github.com"),
        ),
        execute=args.execute,
    )


if __name__ == "__main__":
    main()
