import * as Pulumi from '@pulumi/pulumi';
import Redirect from 'ts/pulumi/lib/redirect';
import Website from 'ts/pulumi/lib/website';

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
			'staging.zemn.me',
			{
				index: 'project/zemn.me/next/out/index.html',
				notFound: 'project/zemn.me/next/out/404.html',
				directory: 'project/zemn.me/next/out',
				zoneId: args.zoneId,
				// this may look weird, but I don't want to replace
				// what's already there until it's ready; so this will double stage
				// to staging.staging.zemn.me.
				domain: ['staging', args.domain].join('.'),
				// since this is itself a staging site
				noIndex: true, // args.noIndex,
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
