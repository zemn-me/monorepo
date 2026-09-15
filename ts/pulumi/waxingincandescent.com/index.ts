import * as aws from '@pulumi/aws';
import * as Pulumi from '@pulumi/pulumi';

import Website from '#root/ts/pulumi/lib/website/website.js';

export interface Args {
	staging: boolean;
	tags?: Pulumi.Input<Record<string, Pulumi.Input<string>>>;
}

export class Component extends Pulumi.ComponentResource {
	readonly site: Website;
	readonly registration?: aws.route53domains.Domain;

	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:waxingincandescent.com', name, args, opts);

		const domainName = 'waxingincandescent.com';
		let zoneId: Pulumi.Input<string>;
		if (args.staging) {
			// Production owns the registration and zone; staging only adds records.
			zoneId = aws.route53.getZoneOutput(
				{ name: `${domainName}.`, privateZone: false },
				{ parent: this }
			).zoneId;
		} else {
			// Reuse the owner's existing registration contacts without putting
			// personal contact details in source control or plaintext state.
			const contacts = aws.route53domains.Domain.get(
				`${name}_registration_contacts`,
				'baby.computer',
				undefined,
				{
					parent: this,
					additionalSecretOutputs: [
						'adminContact',
						'billingContacts',
						'registrantContact',
						'techContact',
					],
				}
			);
			this.registration = new aws.route53domains.Domain(
				`${name}_domain`,
				{
					domainName,
					durationInYears: 1,
					autoRenew: true,
					transferLock: true,
					adminContact: Pulumi.secret(contacts.adminContact),
					registrantContact: Pulumi.secret(contacts.registrantContact),
					techContact: Pulumi.secret(contacts.techContact),
					adminPrivacy: true,
					registrantPrivacy: true,
					techPrivacy: true,
					tags: args.tags,
				},
				{ parent: this, protect: true, retainOnDelete: true }
			);
			// Route 53 creates and delegates the public zone during registration.
			zoneId = this.registration.hostedZoneId;
		}

		const directory = 'ts/pulumi/waxingincandescent.com/build';
		this.site = new Website(
			`${name}_website`,
			{
				directory,
				index: `${directory}/index.html`,
				notFound: `${directory}/404.html`,
				domain: args.staging ? `staging.${domainName}` : domainName,
				zoneId,
				noIndex: args.staging,
				noCostAllocationTag: true,
				email: false,
				tags: args.tags,
			},
			{ parent: this }
		);

		this.registerOutputs({ zoneId, site: this.site });
	}
}
