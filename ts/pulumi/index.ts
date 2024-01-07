import * as aws from '@pulumi/aws';
import * as Pulumi from '@pulumi/pulumi';
import * as Lulu from 'ts/pulumi/lulu.computer';
import * as PleaseIntroduceMeToYourDog from 'ts/pulumi/pleaseintroducemetoyour.dog';
import * as ShadwellIm from 'ts/pulumi/shadwell.im';
import * as ZemnMe from 'ts/pulumi/zemn.me';

export interface Args {
	staging: boolean;
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
				},
				{ parent: this }
			);

		this.zemnMe = new ZemnMe.Component(
			`${name}_zemn.me`,
			{
				zoneId: Pulumi.output(zone.me.zemn.then(z => z.id)),
				domain: stage('zemn.me'),
				noIndex: args.staging,
			},
			{ parent: this }
		);

		this.shadwellIm = new ShadwellIm.Component(
			`${name}_shadwell.im`,
			{
				zoneId: Pulumi.output(zone.im.shadwell.then(z => z.id)),
				domain: stage('shadwell.im'),
				noIndex: args.staging,
			},
			{ parent: this }
		);

		new Lulu.Component(`${name}_lulu`, { staging: args.staging });

		super.registerOutputs({
			pleaseIntroduceMeToYourDog: this.pleaseIntroduceMeToYourDog,
		});
	}
}
