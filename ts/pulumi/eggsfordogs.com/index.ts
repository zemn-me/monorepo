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

		const zone = aws.route53.getZone(
			{
				name: `${domainName}.`,
			},
			{ parent: this }
		);

		const domain = new aws.route53domains.RegisteredDomain(
			`${name}_domain`,
			{
				domainName,
				tags,
				nameServers: zone.then(zone =>
					// this is a bit of a hack.
					// in testing, getZone is going to return undefined, because
					// obviously, it doesn't know what zones exist.
					//
					// So here we fudge it with an empty set of name servers.
					(
						(zone as aws.route53.GetZoneResult | undefined)
							?.nameServers ?? []
					).map(name => ({ name }))
				),
			},
			{ parent: this }
		);

		this.site = new Website(
			`${name}_eggsfordogs.com`,
			{
				index: 'ts/pulumi/eggsfordogs.com/out/index.html',
				notFound: 'ts/pulumi/eggsfordogs.com/out/index.html',
				tags,
				directory: 'ts/pulumi/eggsfordogs.com/out',
				zoneId: zone.then(zone => zone.zoneId),
				domain: domain.domainName.apply(domainName =>
					[...(args.staging ? ['staging'] : []), domainName].join('.')
				),
				noIndex: args.staging,
				email: true,
			},
			{ parent: this }
		);
	}
}
