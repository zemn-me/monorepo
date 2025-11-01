#!/usr/bin/env python3

"""
This file parses the [ASSIGNED_PORTS] environment variable and re‑exports
each entry as a `NEXT_PUBLIC_*` environment variable, then execs the
Next.js binary specified by `NEXTJS_BINARY`.

[ASSIGNED_PORTS]: https://github.com/dzbarsky/rules_itest/blob/master/docs/itest.md#itest_service-env
"""

import json
import os
import sys

from python.runfiles import runfiles

from typing import Optional

from pydantic import BaseModel, Field
from pydantic.config import ConfigDict


class AssignedPorts(BaseModel):
    api_service_port: str = Field(
        alias="@@//project/zemn.me/api/cmd/localserver:localserver_itest_service"
    )
    oidc_provider_port: Optional[str] = Field(
        default=None,
        alias="@@//project/zemn.me/testing:oidc_provider_itest_service",
    )

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

def main() -> None:
    assigned = os.getenv("ASSIGNED_PORTS")
    if not assigned:
        sys.exit("ASSIGNED_PORTS is not set")

    port_map = AssignedPorts.model_validate(json.loads(assigned))

    os.environ["NEXT_PUBLIC_ZEMN_ME_API_BASE"] = (
        "http://localhost:" + str(port_map.api_service_port)
    )

    issuer = None
    if port_map.oidc_provider_port:
        issuer = f"http://localhost:{port_map.oidc_provider_port}"
        os.environ["ZEMN_TEST_OIDC_ISSUER"] = issuer
        os.environ["ZEMN_TEST_OIDC_PROVIDER"] = issuer
    else:
        issuer = os.environ.get("ZEMN_TEST_OIDC_ISSUER", "http://localhost:43111")
        os.environ.setdefault("ZEMN_TEST_OIDC_ISSUER", issuer)
        os.environ.setdefault("ZEMN_TEST_OIDC_PROVIDER", issuer)

    os.environ.setdefault("ZEMN_TEST_OIDC_CLIENT_ID", "integration-test-client")
    os.environ.setdefault("ZEMN_TEST_OIDC_SUBJECT", "integration-test-remote")
    os.environ.setdefault("ZEMN_TEST_OIDC_LOCAL_SUBJECT", "integration-test-local")
    os.environ.setdefault("NEXT_PUBLIC_ZEMN_TEST_OIDC_ISSUER", os.environ["ZEMN_TEST_OIDC_ISSUER"])
    os.environ.setdefault("NEXT_PUBLIC_ZEMN_TEST_OIDC_CLIENT_ID", os.environ["ZEMN_TEST_OIDC_CLIENT_ID"])
    os.environ.setdefault("NEXT_PUBLIC_ZEMN_TEST_OIDC_NAME", "Local Test IdP")

    nextjs_bin_rlocation = os.getenv("NEXTJS_BINARY")
    if not nextjs_bin_rlocation:
        raise RuntimeError("NEXTJS_BINARY is not set")

    r = runfiles.Create()

    if r is None:
        raise RuntimeError("Runfiles not found. Ensure this script is run in a Bazel environment.")

    nextjs_bin = r.Rlocation(nextjs_bin_rlocation)

    if not nextjs_bin:
        raise RuntimeError(f"Next.js binary not found at {nextjs_bin_rlocation}")

    os.execvp(nextjs_bin, [nextjs_bin, *sys.argv[1:]])


if __name__ == "__main__":
    main()
