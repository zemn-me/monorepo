import * as aws from '@pulumi/aws';
import { Budget } from '@pulumi/aws/budgets/index.js';
import { CostAllocationTag } from '@pulumi/aws/costexplorer/index.js';
import * as Pulumi from '@pulumi/pulumi';
import * as random from "@pulumi/random";

import * as Baby from '#root/ts/pulumi/baby.computer/index.js';
import * as EggsDogs from '#root/ts/pulumi/eggsfordogs.com/index.js';
import { DoSync } from '#root/ts/pulumi/github.com/zemn-me/do-sync/do_sync.js';
import { mergeTags, tagsToFilter, tagTrue } from '#root/ts/pulumi/lib/tags.js';
import { getTwilioPhoneNumber, TwilioPhoneNumber } from '#root/ts/pulumi/lib/twilio/phone_number.js';
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

		const twilioSharedSecret = new random.RandomPassword(
			"callbox_twilio_shared_secret",
			{
				length: 16,
			},
			{ parent: this}
		);

		const voiceUrl = twilioSharedSecret.result.apply(
			secret => `https://api.zemn.me/phone/init?secret=${encodeURIComponent(secret)}`
		);

		const twilioOptions = voiceUrl.apply(
			voiceUrl => ({
				voiceMethod: 'GET',
				voiceUrl
			})
		);


		const callboxPhone = new TwilioPhoneNumber(`callboxphonenumber2`, {
			countryCode: 'US',
			options: twilioOptions,
		}, { parent: this, protect: !args.staging });

		// because i cant work out how to make outs happen from a
		// DynamicProvider
		const phoneNumberInfo = callboxPhone.id.apply(
			v => getTwilioPhoneNumber(v)
		);


		this.zemnMe = new ZemnMe.Component(
			`${name}_zemn.me`,
			{
				cloudWorkstations: false, // it was not cheaper than GitHub
				zoneId: Pulumi.output(zone.me.zemn.then(z => z.id)),
				domain: stage('zemn.me'),
				noIndex: args.staging,
				callboxPhoneNumber: phoneNumberInfo.phoneNumber,
				tags,
				protectDatabases: !args.staging,
				gcpProjectId: 'extreme-cycling-441523-a9',
				twilioSharedSecret: twilioSharedSecret.result,
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

		new Baby.Component(
			`${name}_baby`,
			{ staging: args.staging, tags },
			{parent: this },
		)

		new DoSync(
			`${name}_do_sync`,
			{staging: args.staging, tags},
			{ parent: this}
		)

		/**
		 * This zone is for @eggsfordogs to point their namecheap record at;
		 * all the other domains are registered with AWS, so the logic is a
		 * bit different.
		 */
		const eggsForDogsDotComZoneId =
			args.staging
				// staging needs to share the same zone as prod
				? Pulumi.output(aws.route53.getZone({ name: 'eggsfordogs.com' })
					// deleting this infra may crash something...
					.then(v => v.zoneId))
				: new aws.route53.Zone(
					`${name}_eggsfordogs.com_zone`,
					{
						name: 'eggsfordogs.com',
					},
					{ parent: this, protect: !args.staging }
				).zoneId;

		new EggsDogs.Component(
			`${name}_eggsdogs`,
			{ staging: args.staging, tags, zoneId: eggsForDogsDotComZoneId },
			{ parent: this }
		);

		super.registerOutputs({
			pleaseIntroduceMeToYourDog: this.pleaseIntroduceMeToYourDog,
			eggsForDogsDotComZoneId,
		});
	}
}
