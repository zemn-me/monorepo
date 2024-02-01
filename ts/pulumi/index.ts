import * as aws from '@pulumi/aws';
import { Budget } from '@pulumi/aws/budgets/index.js';
import { CostAllocationTag } from '@pulumi/aws/costexplorer/index.js';
import * as Pulumi from '@pulumi/pulumi';

import { mergeTags, tagsToFilter, tagTrue } from '#root/ts/pulumi/lib/tags.js';
import * as Lulu from '#root/ts/pulumi/lulu.computer/index.js';
import * as PleaseIntroduceMeToYourDog from '#root/ts/pulumi/pleaseintroducemetoyour.dog/index.js';
import * as ShadwellIm from '#root/ts/pulumi/shadwell.im/index.js';
import * as ZemnMe from '#root/ts/pulumi/zemn.me/index.js';

export interface Args {
	staging: boolean;
	tags?: Pulumi.Input<Record<string, Pulumi.Input<string>>>;
}

/**
 * The Pulumi infrastructure.
 */
export class Component extends Pulumi.ComponentResource {
	pleaseIntroduceMeToYourDog: PleaseIntroduceMeToYourDog.Component;
	zemnMe: ZemnMe.Component;
	shadwellIm: ShadwellIm.Component;
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:Component', name, args, opts);
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

		// i think pulumi kinda fucks up a little here, because you can totally
		// register hosted zones with duplicate names (and I have committed this crime)
		const zone = {
			im: {
				shadwell: aws.route53.getZone({
					zoneId: 'Z0819383I2XV8V6UY6NO',
				}),
			},
			me: {
				zemn: aws.route53.getZone({ zoneId: 'ZG99IJ8QHXTSI' }),
			},
			dog: {
				pleaseintroducemetoyour: aws.route53.getZone({
					zoneId: 'Z0627984320AKGYW3FTZ5',
				}),
			},
		};

		const stage = (s: string) =>
			[...(args.staging ? ['staging'] : []), s].join('.');

		this.pleaseIntroduceMeToYourDog =
			new PleaseIntroduceMeToYourDog.Component(
				`${name}_pleaseintroducemetoyour.dog`,
				{
					zoneId: Pulumi.output(
						zone.dog.pleaseintroducemetoyour.then(z => z.id)
					),
					domain: stage('pleaseintroducemetoyour.dog'),
					noIndex: args.staging,
					tags,
				},
				{ parent: this }
			);

		new Budget(
			`${name}_budget`,
			{
				budgetType: 'COST',
				timeUnit: 'MONTHLY',
				limitUnit: 'USD',
				limitAmount: '100',
				costFilters: [
					{
						name: 'TagKeyValue',
						values: tagsToFilter(tagTrue(tag)),
					},
				],
			},
			{ parent: this }
		);

		this.zemnMe = new ZemnMe.Component(
			`${name}_zemn.me`,
			{
				zoneId: Pulumi.output(zone.me.zemn.then(z => z.id)),
				domain: stage('zemn.me'),
				noIndex: args.staging,
				tags,
			},
			{ parent: this }
		);

		this.shadwellIm = new ShadwellIm.Component(
			`${name}_shadwell.im`,
			{
				zoneId: Pulumi.output(zone.im.shadwell.then(z => z.id)),
				domain: stage('shadwell.im'),
				noIndex: args.staging,
				tags,
			},
			{ parent: this }
		);

		new Lulu.Component(
			`${name}_lulu`,
			{ staging: args.staging, tags },
			{ parent: this }
		);

		super.registerOutputs({
			pleaseIntroduceMeToYourDog: this.pleaseIntroduceMeToYourDog,
		});
	}
}
