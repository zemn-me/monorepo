/**
 * @fileoverview auth.zemn.me
 */

import * as gcp from '@pulumi/gcp';
import * as Pulumi from '@pulumi/pulumi';

export interface Args {
	zoneId: Pulumi.Input<string>;
	domain: string;
}

// at some point i just need to make this a lib. every fucking cloud
// has its own asinine ideas about what should constitute an identifier
function clampString(baseName: string, suffixLength: number = 10, maxLength: number = 30): string {
    if (suffixLength >= maxLength) {
        throw new Error("Suffix length must be smaller than the maximum length");
    }

    return baseName.slice(0, maxLength - suffixLength)
		.replaceAll(/^[A-Za-z]/g, 'z');
}

export class AuthZemnMe extends Pulumi.ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:zemn.me:auth', name, args, opts);

		const project = new gcp.organizations.Project(clampString(`${name}_project`), {
		}, { parent: this })

		// should be a singleton out there somewhere some day.
		const service = new gcp.projects.Service(clampString(`${name}_enable_iap`), {
			service: 'identitytoolkit.googleapis.com',
			project: project.id
		}, { parent: this });


		const brand = new gcp.iap.Brand(clampString(`${name}_brand`), {
			supportEmail: 'thomas@shadwell.im',
			applicationTitle: args.domain,
			project: service.project
		}, { parent: this })

		const client = new gcp.iap.Client(clampString(`${name}_client`), {
			displayName: args.domain,
			brand: brand.name
		}, { parent: this });

		this.registerOutputs({ client })
	}
}
