/**
 * @fileoverview auth.zemn.me
 */

import * as gcp from '@pulumi/gcp';
import * as Pulumi from '@pulumi/pulumi';

export interface Args {
	zoneId: Pulumi.Input<string>;
	domain: string;
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


		const brand = new gcp.iap.Brand(`${name}_brand`, {
			supportEmail: 'thomas@shadwell.im',
			applicationTitle: args.domain,
			project: service.project
		}, { parent: this })

		const client = new gcp.iap.Client(`${name}_client`, {
			displayName: args.domain,
			brand: brand.name
		}, { parent: this });

		this.registerOutputs({ client })
	}
}
