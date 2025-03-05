import { CostAllocationTag } from '@pulumi/aws/costexplorer/index.js';
import * as Pulumi from '@pulumi/pulumi';

import { bskyDid } from '#root/project/zemn.me/bio/bio.js';
import { BlueskyDisplayNameClaim } from '#root/ts/pulumi/lib/bluesky_username_claim.js';
import { mergeTags, tagTrue } from '#root/ts/pulumi/lib/tags.js';
import Website from '#root/ts/pulumi/lib/website/website.js';
import { ApiZemnMe } from '#root/ts/pulumi/zemn.me/api/api.js';
import { LambdaHelloWorld } from '#root/ts/pulumi/zemn.me/hello_world/hello_world.js';

export interface Args {
	zoneId: Pulumi.Input<string>;
	domain: string;
	noIndex: boolean;
	tags?: Pulumi.Input<Record<string, Pulumi.Input<string>>>;
	gcpProjectId: Pulumi.Input<string>
}

export class Component extends Pulumi.ComponentResource {
	site: Website;
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:shadwell.im', name, args, opts);
		const tag = name;
		const tags = mergeTags(args.tags, tagTrue(tag));

		new CostAllocationTag(
			`${name}_cost_tag`,
			{
				status: 'Active',
				tagKey: tag,
			},
			{ parent: this }
		);

		new LambdaHelloWorld(`${name}_fargate`, {
			tags: args.tags
		});

		this.site = new Website(
			`${name}_zemn_me`,
			{
				index: 'project/zemn.me/out/index.html',
				notFound: 'project/zemn.me/out/404.html',
				directory: 'project/zemn.me/out',
				zoneId: args.zoneId,
				domain: args.domain,
				noIndex: args.noIndex,
				email: false,
				otherTXTRecords: [
					"google-site-verification=Eocoh5nOKEaypNal4oA8OInUzoY9aTTsulvv8aG7Aag"
				],
				tags,
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
				email: false,
				tags,
			},
			{ parent: this }
		);

		new BlueskyDisplayNameClaim(
			`${name}_bluesky_claim`,
			{
				zoneId: args.zoneId,
				displayname: args.domain,
				did: bskyDid
			},
			{ parent: this}
		)

		new ApiZemnMe(`${name}_auth`, {
			domain: ['auth', args.domain].join("."),
			zoneId: args.zoneId,
		}, { parent: this });

		super.registerOutputs({ site: this.site, availability });
	}
}
