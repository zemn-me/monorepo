import { CostAllocationTag } from '@pulumi/aws/costexplorer/index.js';
import * as Pulumi from '@pulumi/pulumi';

import { mergeTags, tagTrue } from '#root/ts/pulumi/lib/tags.js';
import Website from '#root/ts/pulumi/lib/website.js';

export interface Args {
	/**
	 * The zone to deploy to
	 */
	zoneId: Pulumi.Input<string>;

	/**
	 * The domain to deploy to.
	 */
	domain: string;

	/**
	 * Prevent indexing the content.
	 */
	noIndex: boolean;

	tags?: Pulumi.Input<Record<string, Pulumi.Input<string>>>;
}

/**
 * A component that creates the website for pleaseintroducemetoyour.dog
 */
export class Component extends Pulumi.ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:pleaseintroducemetoyour.dog', name, args, opts);
		const tag = name;
		const tags = mergeTags(args.tags, tagTrue(tag));

		const website = new Website(
			`${name}_pleaseintroducemetoyour_dog_website`,
			{
				index: 'ts/pulumi/pleaseintroducemetoyour.dog/out/index.html',
				notFound: 'ts/pulumi/pleaseintroducemetoyour.dog/out/404.html',
				directory: 'ts/pulumi/pleaseintroducemetoyour.dog/out',
				zoneId: args.zoneId,
				domain: args.domain,
				noIndex: args.noIndex,
				tags,
			},
			{ parent: this }
		);

		new CostAllocationTag(
			`${name}_cost_tag`,
			{
				status: 'Active',
				tagKey: name,
			},
			// cannot define CostAllocationTag with zero users.
			{ parent: this, dependsOn: website }
		);

		this.registerOutputs({
			website,
		});
	}
}
