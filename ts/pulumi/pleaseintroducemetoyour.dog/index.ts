import * as aws from '@pulumi/aws';
import * as Pulumi from '@pulumi/pulumi';
import Website from 'ts/pulumi/lib/website';

export interface Args {
	/**
	 * The zone to deploy to
	 */
	zone: aws.route53.Zone;
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
		super('ts::pulumi::pleaseintroducemetoyour.dog', name, args, opts);
		const website = new Website(
			`${name}_pleaseintroducemetoyour_dog_website`,
			{
				index: 'ts/pulumi/pleaseintroducemetoyour.dog/out/index.html',
				notFound: 'ts/pulumi/pleaseintroducemetoyour.dog/out/404.html',
				directory: 'ts/pulumi/pleaseintroducemetoyour.dog/out',
				zone: args.zone,
				subDomain: undefined,
			},
			{ parent: this }
		);

		this.registerOutputs({
			website,
		});
	}
}
