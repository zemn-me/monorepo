import * as Pulumi from '@pulumi/pulumi';
import Website from 'ts/pulumi/lib/website';

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
		const website = new Website(
			`${name}_pleaseintroducemetoyour_dog_website`,
			{
				index: 'ts/pulumi/pleaseintroducemetoyour.dog/out/index.html',
				notFound: 'ts/pulumi/pleaseintroducemetoyour.dog/out/404.html',
				directory: 'ts/pulumi/pleaseintroducemetoyour.dog/out',
				zoneId: args.zoneId,
				domain: args.domain,
				noIndex: args.noIndex,
			},
			{ parent: this }
		);

		this.registerOutputs({
			website,
		});
	}
}
