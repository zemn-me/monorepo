import * as dnsimple from '@pulumi/dnsimple';
import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';

export interface Registration {
	/** Existing DNSimple contact for the intended domain owner. */
	contactId: number;
	extendedAttributes?: Record<string, string>;
}

const project = 'extreme-cycling-441523-a9';
export const tokenSecretId = 'bowery-bugle-dnsimple-token';

/** Production-only registrar resources; DNS stays on Route 53. */
export class Registrar extends pulumi.ComponentResource {
	readonly registration?: dnsimple.RegisteredDomain;
	readonly delegation?: dnsimple.DomainDelegation;

	constructor(
		name: string,
		args: {
			registration?: Registration;
			nameServers: pulumi.Input<pulumi.Input<string>[]>;
		},
		opts?: pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:bowerybugle.nyc:Registrar', name, args, opts);

		// Adopt the pre-seeded container; secret versions stay outside Pulumi.
		const token = new gcp.secretmanager.Secret(
			`${name}_token`,
			{
				project,
				secretId: tokenSecretId,
				replication: { auto: {} },
				deletionProtection: true,
			},
			{
				import: `projects/${project}/secrets/${tokenSecretId}`,
				parent: this,
				protect: true,
				retainOnDelete: true,
			}
		);
		const access = new gcp.secretmanager.SecretIamMember(
			`${name}_token_access`,
			{
				project,
				secretId: token.id,
				member: `serviceAccount:monorepo-root@${project}.iam.gserviceaccount.com`,
				role: 'roles/secretmanager.secretAccessor',
			},
			{ parent: this, protect: true }
		);

		if (args.registration) {
			if (
				!Number.isSafeInteger(args.registration.contactId) ||
				args.registration.contactId <= 0
			) {
				throw new Error(
					'DNSimple contactId must be a positive integer'
				);
			}
			const tokenVersion = gcp.secretmanager.getSecretVersionOutput(
				{ project, secret: token.secretId, version: 'latest' },
				{ parent: this, dependsOn: [access] }
			);
			const provider = new dnsimple.Provider(
				`${name}_provider`,
				{
					account: '178973',
					token: pulumi.secret(tokenVersion.secretData),
					sandbox: false,
				},
				{ parent: this }
			);
			const resourceOptions = {
				parent: this,
				provider,
				protect: true,
				retainOnDelete: true,
			};
			this.registration = new dnsimple.RegisteredDomain(
				`${name}_domain`,
				{
					name: 'bowerybugle.nyc',
					contactId: args.registration.contactId,
					extendedAttributes: args.registration.extendedAttributes,
					autoRenewEnabled: true,
					transferLockEnabled: true,
					whoisPrivacyEnabled: false,
					trustee: false,
				},
				resourceOptions
			);
			this.delegation = new dnsimple.DomainDelegation(
				`${name}_delegation`,
				{
					domain: this.registration.name,
					nameServers: args.nameServers,
				},
				resourceOptions
			);
		}
		this.registerOutputs({
			registrationId: this.registration?.id,
			nameServers: this.delegation?.nameServers,
			tokenSecretId: token.secretId,
		});
	}
}
