import * as Pulumi from '@pulumi/pulumi';
import Website from 'ts/pulumi/lib/website';

export interface Args {
	zoneId: Pulumi.Input<string>;
	domain: string;
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
			},
			{ parent: this }
		);

		super.registerOutputs({ site: this.site });
	}
}
