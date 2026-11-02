"""Run mitmproxy's published console entrypoint in its isolated environment."""

from mitmproxy.tools.main import mitmproxy

if __name__ == "__main__":
    raise SystemExit(mitmproxy())
