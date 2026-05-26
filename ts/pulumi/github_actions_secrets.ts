import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';

const gcpProjectId = 'extreme-cycling-441523-a9';
const gcpProjectNumber = '845702659200';
const githubRepository = 'zemn-me/monorepo';
const githubRepositoryId = '275403409';
const githubRepositoryOwner = 'zemn-me';
const githubRepositoryOwnerId = '145876100';

export const githubActionsSecretProject = gcpProjectId;
export const githubActionsSecretIds = {
	buildbuddyApiKey: 'github-actions-buildbuddy-api-key',
	ghPat: 'github-actions-gh-pat',
	npmToken: 'github-actions-npm-token',
	personalPhoneNumber: 'github-actions-personal-phone-number',
	pulumiAccessToken: 'github-actions-pulumi-access-token',
	readonlyBuildbuddyApiKey: 'github-actions-readonly-buildbuddy-api-key',
	twilioAccountSid: 'github-actions-twilio-account-sid',
	twilioApiKeySid: 'github-actions-twilio-api-key-sid',
	twilioAuthToken: 'github-actions-twilio-auth-token',
} as const;

type GitHubActionsSecretId =
	(typeof githubActionsSecretIds)[keyof typeof githubActionsSecretIds];
type GitHubActionsWorkflowScope =
	| 'presubmit'
	| 'renovate'
	| 'staging'
	| 'submit';

export const githubActionsSecretAccessByWorkflow = {
	presubmit: [githubActionsSecretIds.readonlyBuildbuddyApiKey],
	renovate: [githubActionsSecretIds.ghPat],
	staging: [
		githubActionsSecretIds.buildbuddyApiKey,
		githubActionsSecretIds.personalPhoneNumber,
		githubActionsSecretIds.pulumiAccessToken,
		githubActionsSecretIds.twilioAccountSid,
		githubActionsSecretIds.twilioApiKeySid,
		githubActionsSecretIds.twilioAuthToken,
	],
	submit: [
		githubActionsSecretIds.buildbuddyApiKey,
		githubActionsSecretIds.npmToken,
		githubActionsSecretIds.personalPhoneNumber,
		githubActionsSecretIds.pulumiAccessToken,
		githubActionsSecretIds.twilioAccountSid,
		githubActionsSecretIds.twilioApiKeySid,
		githubActionsSecretIds.twilioAuthToken,
	],
} as const satisfies Record<
	GitHubActionsWorkflowScope,
	readonly GitHubActionsSecretId[]
>;

const workloadIdentityPoolId = 'github';
const workloadIdentityProviderId = 'my-repo';
const githubActionsServiceAccountEmail = `monorepo-root@${gcpProjectId}.iam.gserviceaccount.com`;
const githubActionsServiceAccountName = `projects/${gcpProjectId}/serviceAccounts/${githubActionsServiceAccountEmail}`;

const workflowConditions = {
	presubmit: `assertion.workflow_ref.startsWith("${githubRepository}/.github/workflows/presubmit.yml@refs/heads/gh-readonly-queue/")`,
	renovate: `assertion.workflow_ref == "${githubRepository}/.github/workflows/renovate.yml@refs/heads/main"`,
	staging: `assertion.workflow_ref.startsWith("${githubRepository}/.github/workflows/staging.yml@refs/heads/gh-readonly-queue/")`,
	submit: `assertion.workflow_ref == "${githubRepository}/.github/workflows/submit.yml@refs/heads/main"`,
} as const satisfies Record<GitHubActionsWorkflowScope, string>;

const allowedWorkflowCondition = Object.values(workflowConditions)
	.map(condition => `(${condition})`)
	.join(' || ');

const workflowScopeExpression = [
	`${workflowConditions.presubmit} ? "presubmit"`,
	`: ${workflowConditions.renovate} ? "renovate"`,
	`: ${workflowConditions.staging} ? "staging"`,
	`: ${workflowConditions.submit} ? "submit"`,
	': "unknown"',
].join(' ');

const workflowScopePrincipal = (workflowScope: GitHubActionsWorkflowScope) =>
	`principalSet://iam.googleapis.com/projects/${gcpProjectNumber}/locations/global/workloadIdentityPools/${workloadIdentityPoolId}/attribute.workflow_scope/${workflowScope}`;

export class GitHubActionsSecrets extends pulumi.ComponentResource {
	constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
		super('ts:pulumi:GitHubActionsSecrets', name, {}, opts);

		const services = [
			'iam.googleapis.com',
			'iamcredentials.googleapis.com',
			'secretmanager.googleapis.com',
			'sts.googleapis.com',
		].map(
			service =>
				new gcp.projects.Service(
					`${name}_${service.split('.')[0]}_api`,
					{
						disableOnDestroy: false,
						project: gcpProjectId,
						service,
					},
					{ parent: this, protect: true }
				)
		);

		const pool = new gcp.iam.WorkloadIdentityPool(
			`${name}_pool`,
			{
				description: 'GitHub Actions workload identities.',
				displayName: 'GitHub Actions',
				project: gcpProjectId,
				workloadIdentityPoolId,
			},
			{
				import: `projects/${gcpProjectId}/locations/global/workloadIdentityPools/${workloadIdentityPoolId}`,
				parent: this,
				protect: true,
			}
		);

		const provider = new gcp.iam.WorkloadIdentityPoolProvider(
			`${name}_provider`,
			{
				attributeCondition: [
					`assertion.repository == "${githubRepository}"`,
					`assertion.repository_id == "${githubRepositoryId}"`,
					`assertion.repository_owner == "${githubRepositoryOwner}"`,
					`assertion.repository_owner_id == "${githubRepositoryOwnerId}"`,
					`(assertion.ref == "refs/heads/main" || assertion.ref.startsWith("refs/heads/gh-readonly-queue/"))`,
					`(${allowedWorkflowCondition})`,
				].join(' && '),
				attributeMapping: {
					'attribute.actor': 'assertion.actor',
					'attribute.ref': 'assertion.ref',
					'attribute.repository': 'assertion.repository',
					'attribute.repository_id': 'assertion.repository_id',
					'attribute.repository_owner': 'assertion.repository_owner',
					'attribute.repository_owner_id': 'assertion.repository_owner_id',
					'attribute.workflow_ref': 'assertion.workflow_ref',
					'attribute.workflow_scope': workflowScopeExpression,
					'google.subject': 'assertion.sub',
				},
				description: 'GitHub Actions OIDC provider for zemn-me/monorepo.',
				displayName: 'monorepo',
				oidc: {
					issuerUri: 'https://token.actions.githubusercontent.com',
				},
				project: gcpProjectId,
				workloadIdentityPoolId: pool.workloadIdentityPoolId,
				workloadIdentityPoolProviderId: workloadIdentityProviderId,
			},
			{
				dependsOn: services,
				import: `projects/${gcpProjectId}/locations/global/workloadIdentityPools/${workloadIdentityPoolId}/providers/${workloadIdentityProviderId}`,
				parent: this,
				protect: true,
			}
		);

		for (const workflowScope of ['staging', 'submit'] as const) {
			new gcp.serviceaccount.IAMMember(
				`${name}_${workflowScope}_workload_identity_user`,
				{
					member: workflowScopePrincipal(workflowScope),
					role: 'roles/iam.workloadIdentityUser',
					serviceAccountId: githubActionsServiceAccountName,
				},
				{ dependsOn: provider, parent: this, protect: true }
			);
		}

		const secrets = new Map(
			Object.values(githubActionsSecretIds).map(secretId => {
				const secret = new gcp.secretmanager.Secret(
					`${name}_${secretId}`,
					{
						deletionProtection: true,
						labels: {
							component: 'github-actions',
							repository: 'zemn-me-monorepo',
						},
						project: gcpProjectId,
						replication: { auto: {} },
						secretId,
					},
					{
						dependsOn: services,
						parent: this,
						protect: true,
					}
				);

				return [secretId, secret] as const;
			})
		);

		for (const [workflowScope, secretIds] of Object.entries(
			githubActionsSecretAccessByWorkflow
		) as [GitHubActionsWorkflowScope, readonly GitHubActionsSecretId[]][]) {
			for (const secretId of secretIds) {
				const secret = secrets.get(secretId);
				if (secret === undefined) {
					throw new Error(`missing GitHub Actions secret ${secretId}`);
				}

				new gcp.secretmanager.SecretIamMember(
					`${name}_${workflowScope}_${secretId}_accessor`,
					{
						member: workflowScopePrincipal(workflowScope),
						project: gcpProjectId,
						role: 'roles/secretmanager.secretAccessor',
						secretId: secret.id,
					},
					{ dependsOn: provider, parent: secret, protect: true }
				);
			}
		}

		this.registerOutputs({
			githubActionsServiceAccount: githubActionsServiceAccountEmail,
			secrets: [...secrets.values()],
			workloadIdentityProvider: provider.name,
		});
	}
}
