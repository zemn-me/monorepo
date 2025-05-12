import * as aws from '@pulumi/aws';
import { CostAllocationTag } from '@pulumi/aws/costexplorer/index.js';
import * as Pulumi from '@pulumi/pulumi';

import { mergeTags, tagTrue } from '#root/ts/pulumi/lib/tags.js';
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

		const costAllocation = new CostAllocationTag(
			`${name}_cost_tag`,
			{
				status: 'Active',
				tagKey: name,
			},
			{ parent: this }
		);

		const tags = mergeTags(args.tags, tagTrue(costAllocation.tagKey));

		const domainName = 'eggsfordogs.com';

		const zone = new aws.route53.Zone(
			`${name}_zone`,
			{},
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
