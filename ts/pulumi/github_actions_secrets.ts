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
	openAICuratorApiKey: 'github-actions-openai-curator-api-key',
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
		githubActionsSecretIds.openAICuratorApiKey,
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
const prCachePoolId = 'github-presubmit-cache';
const prCachePrincipal = `principalSet://iam.googleapis.com/projects/${gcpProjectNumber}/locations/global/workloadIdentityPools/${prCachePoolId}/attribute.repository_id/${githubRepositoryId}`;
const githubActionsServiceAccountEmail = `monorepo-root@${gcpProjectId}.iam.gserviceaccount.com`;
const githubActionsServiceAccountName = `projects/${gcpProjectId}/serviceAccounts/${githubActionsServiceAccountEmail}`;
const presubmitWorkflowRef = `${githubRepository}/.github/workflows/presubmit.yml`;
// Workflow guards are editable by PRs; enforce the event boundary in GCP too.
const presubmitMergeQueueCondition = [
	'assertion.event_name == "merge_group"',
	`assertion.workflow_ref.startsWith("${presubmitWorkflowRef}@refs/heads/gh-readonly-queue/")`,
].join(' && ');

const workflowConditions = {
	presubmit: presubmitMergeQueueCondition,
	renovate: `assertion.workflow_ref == "${githubRepository}/.github/workflows/renovate.yml@refs/heads/main"`,
	staging: `assertion.workflow_ref.startsWith("${githubRepository}/.github/workflows/staging.yml@refs/heads/gh-readonly-queue/")`,
	submit: `assertion.workflow_ref == "${githubRepository}/.github/workflows/submit.yml@refs/heads/main"`,
} as const satisfies Record<GitHubActionsWorkflowScope, string>;

const allowedWorkflowCondition = Object.values(workflowConditions)
	.map(condition => `(${condition})`)
	.join(' || ');

const workflowScopeExpression = [
	`(${workflowConditions.presubmit}) ? "presubmit"`,
	`: (${workflowConditions.renovate}) ? "renovate"`,
	`: (${workflowConditions.staging}) ? "staging"`,
	`: (${workflowConditions.submit}) ? "submit"`,
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

		// PRs can change their workflow and read any supplied credentials. Keep
		// their identity in a separate pool with only the cache-key secret grant.
		const prCachePool = new gcp.iam.WorkloadIdentityPool(
			`${name}_pr_cache_pool`,
			{
				description:
					'Untrusted PR access to the read-only build cache.',
				displayName: 'GitHub PR cache',
				project: gcpProjectId,
				workloadIdentityPoolId: prCachePoolId,
			},
			{ dependsOn: services, parent: this, protect: true }
		);
		const prCacheProvider = new gcp.iam.WorkloadIdentityPoolProvider(
			`${name}_pr_cache_provider`,
			{
				attributeCondition: [
					`assertion.repository == "${githubRepository}"`,
					`assertion.repository_id == "${githubRepositoryId}"`,
					`assertion.repository_owner == "${githubRepositoryOwner}"`,
					`assertion.repository_owner_id == "${githubRepositoryOwnerId}"`,
					'assertion.event_name == "pull_request"',
					'assertion.ref.startsWith("refs/pull/")',
					'assertion.ref.endsWith("/merge")',
					`assertion.workflow_ref == "${presubmitWorkflowRef}@" + assertion.ref`,
					`assertion.sub == "repo:${githubRepository}:pull_request"`,
				].join(' && '),
				attributeMapping: {
					'attribute.repository_id': 'assertion.repository_id',
					'google.subject': 'assertion.sub',
				},
				description:
					'PR presubmit cache access without deployment privileges.',
				displayName: 'PR read-only cache',
				oidc: {
					issuerUri: 'https://token.actions.githubusercontent.com',
				},
				project: gcpProjectId,
				workloadIdentityPoolId: prCachePool.workloadIdentityPoolId,
				workloadIdentityPoolProviderId: workloadIdentityProviderId,
			},
			{ dependsOn: services, parent: this, protect: true }
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
						// Seeded through Secret Manager before this deployment can
						// read it. Adopt the container without importing its value.
						...(secretId ===
						githubActionsSecretIds.openAICuratorApiKey
							? {
									import: `projects/${gcpProjectId}/secrets/${secretId}`,
								}
							: {}),
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
					throw new Error(
						`missing GitHub Actions secret ${secretId}`
					);
				}

				if (
					workflowScope === 'presubmit' &&
					secretId === githubActionsSecretIds.readonlyBuildbuddyApiKey
				) {
					new gcp.secretmanager.SecretIamMember(
						`${name}_pr_cache_accessor`,
						{
							member: prCachePrincipal,
							project: gcpProjectId,
							role: 'roles/secretmanager.secretAccessor',
							secretId: secret.id,
						},
						{
							dependsOn: prCacheProvider,
							parent: secret,
							protect: true,
						}
					);
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
			prCacheIdentityProvider: prCacheProvider.name,
		});
	}
}
