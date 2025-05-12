import * as aws from '@pulumi/aws';
import * as Pulumi from '@pulumi/pulumi';

import Website from '#root/ts/pulumi/lib/website/website.js';

export interface Args {
	staging: boolean;
	tags?: Pulumi.Input<Record<string, Pulumi.Input<string>>>;
}


export class Component extends Pulumi.ComponentResource {
	site: Website;
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:eggsfordogs.com', name, args, opts);


		const tags = args.tags;

		const domainName = 'eggsfordogs.com';

		const zone = new aws.route53.Zone(
			`${name}_zone`,
			{
				name: "eggsfordogs.com",
			},
			{ parent: this, protect: true} // namecheap will point to this
		)

		this.site = new Website(
			`${name}_eggsfordogs.com`,
			{
				index: 'ts/pulumi/eggsfordogs.com/out/index.html',
				notFound: 'ts/pulumi/eggsfordogs.com/out/index.html',
				tags,
				directory: 'ts/pulumi/eggsfordogs.com/out',
				zoneId: zone.zoneId,
				domain: [(args.staging ? ['staging'] : []), domainName].join('.'),
				noIndex: args.staging,
				email: true,
			},
			{ parent: this }
		);
	}
}
