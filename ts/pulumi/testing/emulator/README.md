# AWS infrastructure emulator tests

These tests run the existing Pulumi infrastructure program in both staging and
production configurations using the real Pulumi CLI and AWS provider, pointed at
AWS Emulator. They supplement the mock-based unit tests and live staging;
neither staging nor the merge queue is replaced.

## Current compatibility status

The strict full-stack tests do **not** pass with AWS Emulator 1.0.382.1 (the latest
published release checked on 2026-11-14). This work remains a draft while the compatibility
gaps below are unresolved.

Observed emulator/provider compatibility blockers:

| Operation or behaviour                         | Observed result                                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Cost Explorer `UpdateCostAllocationTagsStatus` | HTTP 501 `NotImplemented` for the stack's cost-allocation tags.                                                                     |
| Route 53 Domains `ListTagsForDomain`           | HTTP 501 `NotImplemented` when reading the existing registration.                                                                   |
| Route 53 Domains `EnableDomainTransferLock`    | HTTP 501 `NotImplemented`; required by the production registration's transfer lock.                                                 |
| S3 Control tagging                             | The SDK adds an account-ID host prefix to the endpoint. AWS documents that S3 Control cannot currently reach the emulator this way. |
| EC2 security-group default egress              | The provider's attempt to revoke AWS's default IPv4 egress rule returns `InvalidPermission.NotFound`.                               |

See [AWS's endpoint limitations](https://docs.aws.amazon.com/emulator/latest/userguide/point-sdk-to-emulator.html).
A failed run writes its declared resource list, partial Pulumi resource state,
and provider diagnostics to the test's undeclared outputs as
`staging-aws-resources.json` or `production-aws-resources.json`.

ECR's registry data plane currently serves GET and HEAD, not the upload methods
used by the repository's OCI publisher. The test runs that real publisher only
against the emulator's loopback registry, rather than returning a fictitious
image URI. See the emulator's
[registry implementation](https://github.com/aws/aws-emulator/blob/main/services/service-com-amazonaws-ecr-amazonec2containerregistry-v20150921/src/service/registry_v2.rs).

Run on Linux x86-64:

```sh
./sh/bin/bazel test //ts/pulumi/testing/emulator:staging_test //ts/pulumi/testing/emulator:production_test
```

With the repository's authenticated BuildBuddy execution configuration, macOS
users can run the same tests with `--config=remote --remote_timeout=30m`.

The emulator and AWS/Random provider binaries are versioned and checksum-pinned
in `MODULE.bazel`. Provider versions must match the SDK versions in
`package.json`. No tools are installed globally and Pulumi's automatic plugin
acquisition is disabled. Each test has its own emulator process, assigned port,
credentials, certificate, local Pulumi backend, and plugin directory. Stopping
the emulator discards its resources, including protected and retained resources.

The test seeds the existing hosted zones and domain registration that the real
stack depends on. All AWS resource constructors and AWS data-source calls use
the actual AWS provider. The test compares the program's declared AWS resource
names with the AWS resources recorded in Pulumi state. New resources therefore
join coverage automatically; provider/emulator failures fail the test.

GCP and local command providers use explicit test fixtures. Publishing npm
packages and provisioning Twilio numbers are not performed. OCI image commands
run the real publisher with a guard restricting its destination to the
emulator registry. This tests AWS provisioning, not application execution. Non-AWS fixtures reject unknown resource types. Existing tests and
live staging cover those external integrations.

Only emulator credentials reach the provider. Service endpoints point to the
emulator, account IDs are restricted to its synthetic account, and outbound
HTTP(S) proxy configuration rejects accidentally unconfigured cloud endpoints.
The tests do not validate IAM enforcement, public DNS propagation, certificate
issuance in AWS, or application behaviour on real cloud infrastructure.
