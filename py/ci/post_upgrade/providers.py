"""Keep native Pulumi providers on the exact version of their SDK package.

Run before archive checksum refresh and before Bazel loads the providers.
package.json is the version authority; provider downloads are derived artifacts.
"""

import json
from pathlib import Path
import re


def synchronize(module: str, manifest: dict) -> str:
    packages = {}
    for section in ("dependencies", "devDependencies", "optionalDependencies"):
        for name, version in manifest.get(section, {}).items():
            if name in packages and packages[name] != version:
                raise ValueError(f"Conflicting versions for {name}")
            packages[name] = version

    def replace(match):
        package = "@pulumi/" + match[1].lower().replace("_", "-")
        version = packages.get(package)
        if not isinstance(version, str) or not re.fullmatch(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?", version):
            raise ValueError(f"{package} needs an exact SDK version, got {version!r}")
        return f'PULUMI_{match[1]}_PROVIDER_VERSION = "{version}"'

    return re.sub(r'^PULUMI_([A-Z0-9_]+)_PROVIDER_VERSION\s*=\s*"[^"]+"', replace, module, flags=re.MULTILINE)


if __name__ == "__main__":
    module = Path("MODULE.bazel")
    updated = synchronize(module.read_text(), json.loads(Path("package.json").read_text()))
    module.write_text(updated)
