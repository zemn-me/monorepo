import * as Pulumi from '@pulumi/pulumi';

import Website from '#root/ts/pulumi/lib/website.js';

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
			index: 'ts/pulumi/shadwell.im/luke/out/index.html',
			directory: 'ts/pulumi/shadwell.im/luke/out',
			zoneId: args.zoneId,
			domain: ['luke', args.domain].join('.'),
			noIndex: args.noIndex,
		});

		const kate = new Website(`${name}_kate_shadwell_im_website`, {
			index: 'ts/pulumi/shadwell.im/kate/out/index.html',
			directory: 'ts/pulumi/shadwell.im/kate/out',
			zoneId: args.zoneId,
			domain: ['kate', args.domain].join('.'),
			noIndex: args.noIndex,
		});

		const lucy = new Website(`${name}_lucy_shadwell_im_website`, {
			index: 'ts/pulumi/shadwell.im/lucy/out/index.html',
			directory: 'ts/pulumi/shadwell.im/lucy/out',
			zoneId: args.zoneId,
			domain: ['lucy', args.domain].join('.'),
			noIndex: args.noIndex,
		});

		super.registerOutputs({ site: this.site, luke, kate, lucy });
	}
}
