import * as Pulumi from '@pulumi/pulumi';
import Website from 'ts/pulumi/lib/website';

export interface Args {
	zoneId: Pulumi.Input<string>;
	domain: string;
	noIndex: boolean;
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
				noIndex: args.noIndex,
			},
			{ parent: this }
		);

		const luke = new Website(`${name}_luke_shadwell_im_website`, {
			index: 'ts/pulumi/shadwell.im/luke/index.html',
			directory: 'ts/pulumi/shadwell.im/luke/',
			zoneId: args.zoneId,
			domain: ['luke', args.domain].join('.'),
			noIndex: args.noIndex,
		});

		super.registerOutputs({ site: this.site, luke });
	}
}
