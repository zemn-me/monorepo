# AWS infrastructure emulator tests

These tests run the existing Pulumi infrastructure program in both staging and
production configurations using the real Pulumi CLI and AWS provider, pointed at
AWS Emulator. They supplement the mock-based unit tests and live staging;
neither staging nor the merge queue is replaced.

The loopback compatibility gateway runs as a Go subprocess. Its XML requests
and responses use `encoding/xml` with Go wire structs generated during the Bazel
build from AWS's published Smithy models. The model commit and per-file checksums
are pinned in `MODULE.bazel`; `//go/aws_emulator_gateway/wire` selects the XML
operation inputs and outputs used by the fixtures. Generated files are build
outputs and are not checked in. The Pulumi driver and non-AWS fixture providers
remain in TypeScript.

The small `//bzl/aws_xml` projection derives roots, namespaces, XML member names,
list wrappers, optional members, and HTTP header exclusions from those models.
It supports the scalar, structure, and list shapes used by the selected REST XML
and EC2 Query responses; unsupported shape kinds and XML traits fail generation.
It is not a general Smithy server or request validator. [Smithy Go's published
protocol implementations](https://github.com/aws/smithy-go#supported-protocols) are currently client-only, so they cannot directly
supply our server-side codecs. EC2's protocol-level error envelope is decoded by
the existing AWS Go SDK helper rather than a separate handwritten type.

## zemn.me feature tests

The `zemn_deployment` rules_itest task runs the staging program and checks the
deployed resource state before the feature API or persistence contract starts.
Each test owns its emulator and stack. The API and browser assertions read the
table names, bucket name, and signing key from the deployed API Lambda’s
environment. Browser uploads and playback use signed S3 PUTs and GETs.

Journal uploads follow the stack’s S3 notification to the worker Lambda. The
emulator cannot execute the Go container image. In feature tests Pulumi adds an
asynchronous failure destination and grants the worker role permission to send
to it. The local Go worker processes the original S3 payload from that queue.
The browser’s loopback relay uses the bucket’s deployed CORS rules for its
assigned frontend origin.

## Explicit compatibility fixtures

The test uses AWS Emulator 1.0.382.1. A loopback adapter supplies the following
operations missing from that pinned release; all other API requests are forwarded
to the emulator and their failures remain test failures:

| Fixture                | Scope                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Cost allocation tags   | Update status and read the resulting in-memory status.                                                                    |
| Route 53 Domains       | Registration tag reads/writes, nameserver changes, transfer locks, and completion of those synthetic operations.          |
| Route 53 query logging | Create and read query logging configuration.                                                                              |
| S3 Control             | Bucket tag reads, including the SDK's account-prefixed endpoint.                                                          |
| EC2 security groups    | Reconcile only the default allow-all IPv4 egress rule's missing/duplicate errors.                                         |
| EFS mount targets      | Read the security groups supplied to the real mount-target creation API.                                                  |
| OCI publication        | Seed a synthetic image manifest through the emulator's real ECR `PutImage` API; no image layers are uploaded or executed. |

Asset uploads use small string payloads while preserving every declared S3 object,
key, content type, cache control, and dependency. The emulator limits stored data
to 64 MiB per bucket and 128 MiB total; application asset bytes and multipart
uploads remain covered by live staging. The report lists substituted asset payloads.

These fixtures cover provisioning dependencies, not the AWS semantics of the
mocked operations. Live staging continues to test those paths against AWS.
The JSON test report lists every mocked operation alongside declared resources,
Pulumi state, and provider diagnostics, so a passing test does not hide its scope.
New unsupported operations fail normally rather than becoming automatic mocks.

See [AWS's endpoint limitations](https://docs.aws.amazon.com/emulator/latest/userguide/point-sdk-to-emulator.html)
and the emulator's [read-only registry implementation](https://github.com/aws/aws-emulator/blob/main/services/service-com-amazonaws-ecr-amazonec2containerregistry-v20150921/src/service/registry_v2.rs).

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
seed synthetic manifests in the emulator registry. This tests AWS provisioning,
not application execution. Non-AWS fixtures reject unknown resource types.
Existing tests and live staging cover those external integrations.

Only emulator credentials reach the provider. Service endpoints point to the
emulator, account IDs are restricted to its synthetic account, and outbound
HTTP(S) proxy configuration rejects accidentally unconfigured cloud endpoints.
The tests do not validate IAM enforcement, public DNS propagation, certificate
issuance in AWS, or application behaviour on real cloud infrastructure.
