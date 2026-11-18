# Non-root AWS access

Status: proposed migration; merging this document does not create identities,
grant access, change session settings, or add resources to either Pulumi stack.
Complete the approval and verification steps below before activating access.

## Goal and evidence

Let Thomas and an owner-authorized dot session investigate AWS without repeatedly
renewing a root CLI login. Keep infrastructure changes in the existing reviewed
PR and CI deployment workflow.

Read-only checks on 2026-11-04 found:

- The CLI caller was `arn:aws:iam::658613637108:root`.
- Account `658613637108` is its AWS Organizations management account, with all
  features enabled. No new organization is needed.
- `sso-admin list-instances` returned no instances in `us-east-1`, `us-west-2`,
  and `eu-west-1`. This is not an exhaustive regional inventory. Before enabling
  anything, check the organization's console for an existing instance and its
  home Region; reuse it if present.
- Pulumi uses `us-east-1`. GitHub Actions already assumes the protected
  `monorepo_github_actions_role-4ad3390` through GitHub OIDC. The Submit and Staging
  workflows deploy changes on main and merge-queue refs respectively.
- No open PR matching AWS access or Identity Center was found when preparing
  this proposal. Existing journal work remains independent.

## Proposed identity and session model

Use an **organization instance** of IAM Identity Center, preferably in
`us-east-1` if none exists. An account instance cannot provide this AWS account
access. Use the existing identity provider if one is configured; otherwise use
the Identity Center directory with MFA required at every new sign-in.

Propose a **90-day user interactive session** (129600 minutes), paired with a
**one-hour permission-set session** (`PT1H`). These are separate settings: the
refreshable AWS CLI SSO token provider can obtain new short-lived credentials
while the sign-in remains valid. No individual AWS credential lasts 90 days.
The portal duration is an instance-wide setting and may affect other users;
inspect that scope before approving it. External IdP session limits can shorten
the effective duration. Use current AWS CLI v2; session management requires at
least v2.9. The device-authorization commands below target v2.22 or later
(older versions use device authorization by default).

Thomas owns the human identity, MFA, recovery addresses, and any administrative
bootstrap. Use a separately named `dot-operator` identity for an owner-approved
operator environment only if the identity source supports that arrangement;
Thomas must control its authentication and recovery. Otherwise use an explicitly
authorized Thomas SSO session in the owner-controlled environment and record that
CloudTrail attributes its actions to Thomas. A CLI profile name alone does not
create a separate auditable identity. Never share passwords, issue permanent IAM
user access keys, or let the assistant control account recovery.

Assign `JournalLogReader` to the approved operator identity/group and Thomas.
Start with the policy below and `PT1H`. Do not attach `ReadOnlyAccess`,
`PowerUserAccess`, or `AdministratorAccess` to the routine operator: those grant
far more than the immediate journal log task requires. Broader tasks require
separately reviewed, resource-scoped additions. Owner administrative recovery, if
needed, uses a separate short-session permission set with no dot assignment.

Identity Center manages its generated `AWSReservedSSO_` role trust. Do not add
root, arbitrary AWS principals, or GitHub tokens as alternate trust principals.
Keep CI's existing OIDC role and workflow/ref restrictions unchanged. The current
CI role is administrative; restricting it is a separate project. SCPs do not
restrict principals in the Organizations management account, so IAM permissions
and the identity boundary must enforce the operator restrictions here.

## Initial permission policy

The proposed policy reads only the six journal/API Lambda log groups identified
from live `lambda list-functions` on 2026-11-04. They cover staging and production;
confirm those environments are both wanted before assignment. Log contents may
include private journal material. Existing and future streams in these groups
are readable, but other groups and replacement function names are excluded.
Recheck names before activation and review replacements through a policy update.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadJournalLogs",
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogStreams",
        "logs:FilterLogEvents"
      ],
      "Resource": [
        "arn:aws:logs:us-east-1:658613637108:log-group:/aws/lambda/journalcuratorlambda-2c615cc",
        "arn:aws:logs:us-east-1:658613637108:log-group:/aws/lambda/journalcuratorlambda-f57487f",
        "arn:aws:logs:us-east-1:658613637108:log-group:/aws/lambda/journalworkerlambda-075035b",
        "arn:aws:logs:us-east-1:658613637108:log-group:/aws/lambda/journalworkerlambda-3c8d0f8",
        "arn:aws:logs:us-east-1:658613637108:log-group:/aws/lambda/apizemnmelambdafunction-ffe7324",
        "arn:aws:logs:us-east-1:658613637108:log-group:/aws/lambda/apizemnmelambdafunction-759d819"
      ]
    }
  ]
}
```

This deliberately omits account-wide log discovery, Logs Insights queries,
unmasking, Lambda invocation/configuration, journal/audio storage access, KMS
decryption, secrets retrieval, IAM/SSO administration, and role assumption. The
operator supplies a known group name when using `aws logs tail`.

## Activation sequence and approval boundary

1. Repeat `aws sts get-caller-identity`,
   `aws organizations describe-organization`, and instance discovery in the
   verified home Region. Confirm account ownership, identity source, actual
   user/group IDs, MFA/recovery, and absence of a competing migration.
2. Present a concrete activation request to Thomas: instance/home Region,
   identity source and exact principals, `JournalLogReader` policy, `PT1H`,
   90-day instance-wide interactive duration, staging/production scope, and any
   owner-only recovery permission. Obtain action-time approval before creating
   identities, enabling an instance, granting assignments, or changing settings.
3. Following approval, bootstrap or reuse the organization instance. Configure
   MFA and recovery under Thomas's control. Set the interactive duration in the
   Identity Center console; it is not the permission-set duration. Reconcile any
   external IdP limit. Capture non-secret identifiers and settings for review.
4. Prepare a separate implementation PR using Pulumi's SSO administration
   resources for the permission set, inline policy, and exact account
   assignment. Use verified IDs rather than guessed names. Ensure shared
   identity resources are production-owned, never duplicated by staging.
   Mock tests must demonstrate no assignments in staging, exact account and
   principal scope, `PT1H`, and no additional permissions. Review the actual
   production preview before its approved deployment. A merge-queue deployment
   is a live change too; do not enqueue this implementation until approved.
5. Configure named SSO profiles and verify the new session as below. Preserve
   the existing default/root profile until Thomas verifies the replacement and
   recovery path; then retire routine root use. Do not delete root MFA or change
   root recovery as part of this migration.

## CLI configuration and remote sign-in

After activation, run `aws configure sso --profile journal-logs`. Enter the
verified portal URL and home Region, registration scope `sso:account:access`,
account `658613637108`, and role `JournalLogReader`. Use a named `sso-session`
section, not the legacy non-refreshable SSO profile format. Configure the default
service Region as `us-east-1`; never write tokens or passwords into the repo.

For Thomas to authorize from another device while the laptop is unavailable:

```sh
aws sso login --profile journal-logs --use-device-code --no-browser
aws sts get-caller-identity --profile journal-logs
aws logs tail /aws/lambda/journalcuratorlambda-2c615cc \
  --profile journal-logs --region us-east-1 --since 10m
```

Thomas opens the generated AWS verification URL and approves the device directly.
Do not paste root sign-in codes or cached credentials into chat. Explicitly select
the profile on each command; existing `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, or `AWS_SESSION_TOKEN` environment variables can override
the intended provider. Verify the resulting caller account and `AWSReservedSSO_`
role ARN before reading logs. Do not export credentials into environment variables
for long-running use; let a supported CLI/SDK refresh them.

## Acceptance and recovery

- Confirm both intended identities resolve to the correct account and assigned
  SSO role, never root or the CI deployment role.
- Confirm a known allowed group can be tailed. Use IAM policy simulation to
  verify unrelated log groups, other Regions/accounts, `iam:CreateAccessKey`,
  `sts:AssumeRole`, `lambda:InvokeFunction`, `secretsmanager:GetSecretValue`, and
  journal S3/DynamoDB reads are denied. Do not exercise real mutations as tests.
- Verify credential refresh after one hour without another interactive login.
  Record actual expiry/refresh behavior over subsequent days; a configured
  90-day duration is not evidence that a 90-day session has been tested.
- Review CloudTrail attribution and ensure applicable logging exists. Confirm
  Thomas can recover with a separately protected owner path before retiring
  routine root use. Root should retain MFA and recovery outside the laptop.
- A stolen SSO refresh token can obtain new role sessions for the remaining
  interactive lifetime. Secure the host and local SSO cache, restrict operator
  permissions, and keep logs/tokens out of commits and chat.
- For loss or compromise, Thomas ends the user's Identity Center sessions and
  removes/disables its assignment or identity, then checks CloudTrail. Already
  issued IAM role credentials can remain valid for up to the configured hour;
  session termination alone is not instant revocation. Use an authorized
  emergency deny/revocation procedure if immediate containment is necessary.
- Roll back by removing the new assignments through a reviewed, approved change,
  revoking sessions, and restoring the prior interactive duration if changed.
  Account for the same outstanding-role-session window. Do not broaden CI trust
  or add permanent credentials to recover from an SSO configuration mistake.

## AWS references

- [Instance capabilities](https://docs.aws.amazon.com/singlesignon/latest/userguide/identity-center-instances.html)
- [Session management and renewal](https://docs.aws.amazon.com/sdkref/latest/guide/understanding-sso.html)
- [Interactive session configuration](https://docs.aws.amazon.com/singlesignon/latest/userguide/configure-user-session.html)
- [Account role session duration](https://docs.aws.amazon.com/singlesignon/latest/userguide/howtosessionduration.html)
- [Refreshable SSO CLI and device authorization](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html)
- [Session limits and prerequisites](https://docs.aws.amazon.com/singlesignon/latest/userguide/user-session-duration-prereqs-considerations.html)
- [Session termination effects](https://docs.aws.amazon.com/singlesignon/latest/userguide/authconcept.html)
- [CloudWatch Logs IAM actions and resources](https://docs.aws.amazon.com/service-authorization/latest/reference/list_logs.html)
- [SCP scope](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html)
