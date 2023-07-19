import * as aws from '@pulumi/aws';
import * as Pulumi from '@pulumi/pulumi';
import Website from 'ts/pulumi/lib/website';

export interface Args {
	zone: aws.route53.Zone;
}

export class Component extends Pulumi.ComponentResource {
	site: Website;
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts::pulumi::shadwell.im', name, args, opts);

		this.site = new Website(
			'staging.zemn.me',
			{
				index: 'project/zemn.me/next/out/index.html',
				notFound: 'project/zemn.me/next/out/404.html',
				directory: 'project/zemn.me/next/out',
				zone: args.zone,
				subDomain: 'staging',
			},
			{ parent: this }
		);

		super.registerOutputs({ site: this.site });
	}
}
