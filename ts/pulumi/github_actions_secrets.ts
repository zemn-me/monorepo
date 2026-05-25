import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';

const gcpProjectId = 'extreme-cycling-441523-a9';
const gcpProjectNumber = '845702659200';
const githubRepository = 'zemn-me/monorepo';

export const githubActionsSecretProject = gcpProjectId;
export const githubActionsSecretIds = {
	buildbuddyApiKey: 'github-actions-buildbuddy-api-key',
	ghPat: 'github-actions-gh-pat',
	npmToken: 'github-actions-npm-token',
	personalPhoneNumber: 'github-actions-personal-phone-number',
	pulumiAccessToken: 'github-actions-pulumi-access-token',
	twilioAccountSid: 'github-actions-twilio-account-sid',
	twilioApiKeySid: 'github-actions-twilio-api-key-sid',
	twilioAuthToken: 'github-actions-twilio-auth-token',
} as const;

const workloadIdentityPoolId = 'github';
const workloadIdentityProviderId = 'my-repo';
const githubActionsServiceAccountEmail = `monorepo-root@${gcpProjectId}.iam.gserviceaccount.com`;
const githubActionsServiceAccountName = `projects/${gcpProjectId}/serviceAccounts/${githubActionsServiceAccountEmail}`;

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
					{ parent: this }
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

		const allowedWorkflowCondition = [
			`assertion.workflow_ref == "${githubRepository}/.github/workflows/submit.yml@refs/heads/main"`,
			`assertion.workflow_ref == "${githubRepository}/.github/workflows/renovate.yml@refs/heads/main"`,
			`assertion.workflow_ref.startsWith("${githubRepository}/.github/workflows/staging.yml@refs/heads/gh-readonly-queue/")`,
			`assertion.workflow_ref.startsWith("${githubRepository}/.github/workflows/presubmit.yml@refs/heads/gh-readonly-queue/")`,
		].join(' || ');

		const provider = new gcp.iam.WorkloadIdentityPoolProvider(
			`${name}_provider`,
			{
				attributeCondition: [
					`assertion.repository == "${githubRepository}"`,
					`(assertion.ref == "refs/heads/main" || assertion.ref.startsWith("refs/heads/gh-readonly-queue/"))`,
					`(${allowedWorkflowCondition})`,
				].join(' && '),
				attributeMapping: {
					'attribute.actor': 'assertion.actor',
					'attribute.ref': 'assertion.ref',
					'attribute.repository': 'assertion.repository',
					'attribute.repository_owner': 'assertion.repository_owner',
					'attribute.workflow_ref': 'assertion.workflow_ref',
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

		const member = `principalSet://iam.googleapis.com/projects/${gcpProjectNumber}/locations/global/workloadIdentityPools/${workloadIdentityPoolId}/attribute.repository/${githubRepository}`;
		new gcp.serviceaccount.IAMMember(
			`${name}_workload_identity_user`,
			{
				member,
				role: 'roles/iam.workloadIdentityUser',
				serviceAccountId: githubActionsServiceAccountName,
			},
			{ dependsOn: provider, parent: this }
		);

		const secrets = Object.values(githubActionsSecretIds).map(secretId => {
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

			new gcp.secretmanager.SecretIamMember(
				`${name}_${secretId}_accessor`,
				{
					member: `serviceAccount:${githubActionsServiceAccountEmail}`,
					project: gcpProjectId,
					role: 'roles/secretmanager.secretAccessor',
					secretId: secret.id,
				},
				{ parent: secret }
			);

			return secret;
		});

		this.registerOutputs({
			githubActionsServiceAccount: githubActionsServiceAccountEmail,
			secrets,
			workloadIdentityProvider: provider.name,
		});
	}
}
