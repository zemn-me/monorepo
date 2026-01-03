import * as gcp from "@pulumi/gcp";
import * as Pulumi from "@pulumi/pulumi";

export interface GitHubActionsOidcArgs {
	projectId: Pulumi.Input<string>;
	projectNumber: Pulumi.Input<string>;
	repository: Pulumi.Input<string>;
	serviceAccountId?: Pulumi.Input<string>;
	location?: Pulumi.Input<string>;
}

export class GitHubActionsOidc extends Pulumi.ComponentResource {
	pool: gcp.iam.WorkloadIdentityPool;
	provider: gcp.iam.WorkloadIdentityPoolProvider;
	serviceAccount: gcp.serviceaccount.Account;
	workloadIdentityBinding: gcp.serviceaccount.IAMMember;

	constructor(
		name: string,
		args: GitHubActionsOidcArgs,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:gcp:GitHubActionsOidc', name, args, opts);

		const location = args.location ?? 'global';
		const serviceAccountId = args.serviceAccountId ?? 'monorepo-root';

		this.pool = new gcp.iam.WorkloadIdentityPool(
			`${name}_pool`,
			{
				project: args.projectId,
				location,
				workloadIdentityPoolId: 'github',
				displayName: 'GitHub',
				description:
					'GitHub Actions workload identity federation for the monorepo',
			},
			{ parent: this }
		);

		this.provider = new gcp.iam.WorkloadIdentityPoolProvider(
			`${name}_provider`,
			{
				project: args.projectId,
				location,
				workloadIdentityPoolId: this.pool.workloadIdentityPoolId,
				workloadIdentityPoolProviderId: 'my-repo',
				displayName: 'GitHub Actions OIDC',
				description: Pulumi.interpolate`OIDC provider for ${args.repository}`,
				// mirror AWS allow list: main branch + gh-readonly-queue/* merge queue.
				attributeCondition:
					'assertion.sub.startsWith("repo:zemn-me/monorepo:ref:refs/heads/main") || ' +
					'assertion.sub.startsWith("repo:zemn-me/monorepo:ref:refs/heads/gh-readonly-queue/")',
				attributeMapping: {
					'google.subject': 'assertion.sub',
					'attribute.actor': 'assertion.actor',
					'attribute.aud': 'assertion.aud',
					'attribute.repository': 'assertion.repository',
					'attribute.ref': 'assertion.ref',
					'attribute.workflow': 'assertion.workflow',
				},
				oidc: {
					issuerUri: 'https://token.actions.githubusercontent.com',
					allowedAudiences: [
						Pulumi.interpolate`https://iam.googleapis.com/projects/${args.projectNumber}/locations/${location}/workloadIdentityPools/github/providers/my-repo`,
					],
				},
			},
			{ parent: this }
		);

		this.serviceAccount = new gcp.serviceaccount.Account(
			`${name}_sa`,
			{
				project: args.projectId,
				accountId: serviceAccountId,
				displayName: 'monorepo root',
			},
			{ parent: this }
		);

		const poolPrincipal = Pulumi.interpolate`principalSet://iam.googleapis.com/projects/${args.projectNumber}/locations/${location}/workloadIdentityPools/${this.pool.workloadIdentityPoolId}/attribute.repository/${args.repository}`;

		this.workloadIdentityBinding = new gcp.serviceaccount.IAMMember(
			`${name}_wif_binding`,
			{
				serviceAccountId: this.serviceAccount.name,
				role: 'roles/iam.workloadIdentityUser',
				member: poolPrincipal,
			},
			{ parent: this }
		);

		this.registerOutputs({
			poolName: this.pool.name,
			providerName: this.provider.name,
			serviceAccountEmail: this.serviceAccount.email,
		});
	}
}
