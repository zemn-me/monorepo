/**
 * @fileoverview auth.zemn.me
 */

import * as gcp from '@pulumi/gcp';
import * as Pulumi from '@pulumi/pulumi';

export interface Args {
	zoneId: Pulumi.Input<string>;
	domain: string;
	noIndex: boolean;
}

export class AuthZemnMe extends Pulumi.ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:zemn.me:auth', name, args, opts);

		const project = new gcp.organizations.Project(`${name}_project`, {
		}, { parent: this })

		// should be a singleton out there somewhere some day.
		const service = new gcp.projects.Service(`${name}_enable_iap`, {
			service: 'identitytoolkit.googleapis.com',
			project: project.id
		}, { parent: this });

		const domainName = Pulumi.output(args.zoneId).apply(
			i => [args.domain, i].join(".")
		);

		const brand = new gcp.iap.Brand(`${name}_brand`, {
			supportEmail: 'thomas@shadwell.im',
			applicationTitle: domainName,
			project: service.project
		})

		const client = new gcp.iap.Client(`${name}_client`, {
			displayName: domainName,
			brand: brand.name
		}, { parent: this });

		this.registerOutputs({ client })
	}
}
