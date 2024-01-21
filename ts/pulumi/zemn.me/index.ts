import * as Pulumi from '@pulumi/pulumi';

import Website from '#root/ts/pulumi/lib/website.js';

//

export interface Args {
	zoneId: Pulumi.Input<string>;
	domain: string;
	noIndex: boolean;
}

export class Component extends Pulumi.ComponentResource {
	site: Website;
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:shadwell.im', name, args, opts);

		this.site = new Website(
			`${name}_zemn_me`,
			{
				index: 'project/zemn.me/out/index.html',
				notFound: 'project/zemn.me/out/404.html',
				directory: 'project/zemn.me/out',
				zoneId: args.zoneId,
				domain: args.domain,
				noIndex: args.noIndex,
			},
			{ parent: this }
		);

		const availability = new Website(
			`${name}_availability_zemn_me_website`,
			{
				index: 'ts/pulumi/zemn.me/availability/out/index.html',
				notFound: 'ts/pulumi/zemn.me/availability/out/404.html',
				directory: 'ts/pulumi/zemn.me/availability/out',
				zoneId: args.zoneId,
				domain: ['availability', args.domain].join('.'),
				noIndex: true, // args.noIndex,
			},
			{ parent: this }
		);

		super.registerOutputs({ site: this.site, availability });
	}
}
