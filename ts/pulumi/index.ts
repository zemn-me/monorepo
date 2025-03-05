import * as aws from '@pulumi/aws';
import { Budget } from '@pulumi/aws/budgets/index.js';
import { CostAllocationTag } from '@pulumi/aws/costexplorer/index.js';
import * as Pulumi from '@pulumi/pulumi';

import * as Baby from '#root/ts/pulumi/baby.computer/index.js';
import { DoSync } from '#root/ts/pulumi/github.com/zemn-me/do-sync/do_sync.js';
import { mergeTags, tagsToFilter, tagTrue } from '#root/ts/pulumi/lib/tags.js';
import { getTwilioPhoneNumber, TwilioPhoneNumber } from '#root/ts/pulumi/lib/twilio/phone_number.js';
import * as Lulu from '#root/ts/pulumi/lulu.computer/index.js';
import * as PleaseIntroduceMeToYourDog from '#root/ts/pulumi/pleaseintroducemetoyour.dog/index.js';
import * as ShadwellIm from '#root/ts/pulumi/shadwell.im/index.js';
import * as ZemnMe from '#root/ts/pulumi/zemn.me/index.js';


const personalPhoneNumber = () =>
	process.env['PERSONAL_PHONE_NUMBER'];

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


		const personalPhone = personalPhoneNumber();

		const callboxPhone = new TwilioPhoneNumber(`callboxphonenumber2`, {
			countryCode: 'US',
			options: {
				voiceUrl:
					personalPhone?
						`https://twimlets.com/forward?PhoneNumber=${encodeURIComponent(personalPhone)}`:
						'https://twimlets.com/message?Message%5B0%5D=If+you+are+hearing+this%2C+then+it+must+be+working%21'
			}
		}, { parent: this, protect: !args.staging });

		// because i cant work out how to make outs happen from a
		// DynamicProvider
		const phoneNumberInfo = callboxPhone.id.apply(
			v => getTwilioPhoneNumber(v)
		);


		this.zemnMe = new ZemnMe.Component(
			`${name}_zemn.me`,
			{
				zoneId: Pulumi.output(zone.me.zemn.then(z => z.id)),
				domain: stage('zemn.me'),
				noIndex: args.staging,
				callboxPhoneNumber: phoneNumberInfo.phoneNumber,
				tags,
				gcpProjectId: 'extreme-cycling-441523-a9',
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



		super.registerOutputs({
			pleaseIntroduceMeToYourDog: this.pleaseIntroduceMeToYourDog,
		});
	}
}
