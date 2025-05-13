import * as Pulumi from '@pulumi/pulumi';

import { BlueskyDisplayNameClaim } from '#root/ts/pulumi/lib/bluesky_username_claim.js';
import Website from '#root/ts/pulumi/lib/website/website.js';

export interface Args {
	staging: boolean;
	zoneId: Pulumi.Input<string>;
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

		const domainName = [...(args.staging ? ['staging'] : []), "eggsfordogs.com"].join('.');

		new BlueskyDisplayNameClaim(
			`${name}_bluesky_claim`,
			{
				zoneId: args.zoneId,
				displayname: domainName,
				did: "did:plc:7npbillg4uotx5cdcbvnjhpn"
			},
			{ parent: this}
		)

		this.site = new Website(
			`${name}_eggsfordogs.com`,
			{
				index: 'ts/pulumi/eggsfordogs.com/out/index.html',
				notFound: 'ts/pulumi/eggsfordogs.com/out/index.html',
				tags,
				directory: 'ts/pulumi/eggsfordogs.com/out',
				zoneId: args.zoneId,
				domain: domainName,
				noIndex: args.staging,
				email: true,
				noCostAllocationTag: true,
			},
			{ parent: this }
		);
	}
}
