# AWS infrastructure emulator tests

These tests run the existing Pulumi infrastructure program in both staging and
production configurations using the real Pulumi CLI and AWS provider, pointed at
AWS Emulator. They supplement the mock-based unit tests and live staging;
neither staging nor the merge queue is replaced.

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
packages, uploading container images, and provisioning Twilio numbers are not
performed. The OCI command fixture returns the repository and digest reference
that an upload would produce; this tests AWS provisioning, not container image
execution. Non-AWS fixtures reject unknown resource types. Existing tests and
live staging cover those external integrations.

Only emulator credentials reach the provider. Service endpoints point to the
emulator, account IDs are restricted to its synthetic account, and outbound
HTTP(S) proxy configuration rejects accidentally unconfigured cloud endpoints.
The tests do not validate IAM enforcement, public DNS propagation, certificate
issuance in AWS, or application behaviour on real cloud infrastructure.
