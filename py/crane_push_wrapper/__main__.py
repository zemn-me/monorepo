#!/usr/bin/env python3

"""
Wraps the bazel executable produced by a rules_oci push rule.

(see: https://github.com/bazel-contrib/rules_oci/blob/main/docs/push.md)

This wrapper makes the following changes:

1. Stderr is buffered — stderr is *only* printed if the program exits with a
nonzero status

2. Failures due to existing manifest are not considered failures — output is
the same as if the operation succeeded.

In order for (2) to work correctly, Pulumi's `addPreviousOutputInEnv` must be
set to true: https://www.pulumi.com/registry/packages/command/api-docs/local/command/#constructor-example
"""



