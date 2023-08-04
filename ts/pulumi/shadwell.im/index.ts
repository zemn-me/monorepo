import * as Pulumi from '@pulumi/pulumi';
import Website from 'ts/pulumi/lib/website';

export interface Args {
	zoneId: Pulumi.Input<string>;
	domain: string;
}

/**
 * Handles the provisioning of shadwell.im
 */
export class Component extends Pulumi.ComponentResource {
	site: Website;
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:shadwell.im', name, args, opts);

		this.site = new Website(
			`${name}_thomas_shadwell_im_website`,
			{
				index: 'ts/pulumi/shadwell.im/thomas/index.html',
				directory: 'ts/pulumi/shadwell.im/thomas/',
				zoneId: args.zoneId,
				domain: ['thomas', args.domain].join('.'),
			},
			{ parent: this }
		);

		super.registerOutputs({ site: this.site });
	}
}
