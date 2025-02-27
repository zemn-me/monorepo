/**
 * @fileoverview auth.zemn.me
 */

import * as gcp from '@pulumi/gcp';
import * as Pulumi from '@pulumi/pulumi';

export interface Args {
	zoneId: Pulumi.Input<string>;
	domain: string;
	gcpProjectId: Pulumi.Input<string>;
}

// at some point i just need to make this a lib. every fucking cloud
// has its own asinine ideas about what should constitute an identifier
function clampString(baseName: string, suffixLength: number = 10, maxLength: number = 30): string {
    if (suffixLength >= maxLength) {
        throw new Error("Suffix length must be smaller than the maximum length");
    }

    return baseName.slice(0, maxLength - suffixLength)
		.replaceAll(/[^A-Za-z]/g, 'z');
}

export class AuthZemnMe extends Pulumi.ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:zemn.me:auth', name, args, opts);

		// should be a singleton out there somewhere some day.
		new gcp.projects.Service(clampString(`${name}_enable_iap`), {
			service: 'iap.googleapis.com',
			project: args.gcpProjectId,
		}, { parent: this });

	}
}
