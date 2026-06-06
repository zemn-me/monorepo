#!/usr/bin/env python3

import json
import os
import sys

from pydantic import BaseModel, ConfigDict, Field
from python.runfiles import runfiles


class AssignedPorts(BaseModel):
    api_service_port: str | None = Field(
        default=None,
        alias="@@//project/me/zemn/api/cmd/localserver:localserver_itest_service"
    )
    calendar_fixture_api_service_port: str | None = Field(
        default=None,
        alias="@@//project/me/zemn/api/cmd/localserver:localserver_calendar_fixture_itest_service",
    )

    model_config = ConfigDict(extra="ignore", populate_by_name=True)


def main() -> None:
    assigned = os.getenv("ASSIGNED_PORTS")
    if not assigned:
        sys.exit("ASSIGNED_PORTS is not set")

    port_map = AssignedPorts.model_validate(json.loads(assigned))
    api_service_port = (
        port_map.api_service_port or port_map.calendar_fixture_api_service_port
    )
    if not api_service_port:
        sys.exit("API service port is not set in ASSIGNED_PORTS")

    os.environ["NEXT_PUBLIC_ZEMN_ME_API_BASE"] = (
        "http://localhost:" + str(api_service_port)
    )

    nextjs_bin_rlocation = os.getenv("NEXTJS_BINARY")
    if not nextjs_bin_rlocation:
        raise RuntimeError("NEXTJS_BINARY is not set")

    r = runfiles.Create()
    if r is None:
        raise RuntimeError("Runfiles not found. Ensure this script is run in Bazel.")

    nextjs_bin = r.Rlocation(nextjs_bin_rlocation)
    if not nextjs_bin:
        raise RuntimeError(f"Next.js binary not found at {nextjs_bin_rlocation}")

    os.execvp(nextjs_bin, [nextjs_bin, *sys.argv[1:]])


if __name__ == "__main__":
    main()
