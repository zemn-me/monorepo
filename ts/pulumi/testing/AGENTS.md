Integration tests for downstream Next sites that call `api.zemn.me` need a small wrapper binary that reads `ASSIGNED_PORTS` and exports `NEXT_PUBLIC_ZEMN_ME_API_BASE` before execing the site `:dev` target. Running the raw Next service directly will point analytics at production instead of the local test API.

Keep helper Python for this package in a dedicated subdirectory with its own `BUILD.bazel`. A top-level `.py` file in `ts/pulumi/testing` collides with the existing `testing` target name when `gazelle` tries to autogenerate Python rules.
