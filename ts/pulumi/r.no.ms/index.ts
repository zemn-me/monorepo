import * as aws from '@pulumi/aws';
import * as Pulumi from '@pulumi/pulumi';

import Website from '#root/ts/pulumi/lib/website/website.js';

const websiteBuildDirectory = 'project/ms/no/r/build';
const indexDocument = `${websiteBuildDirectory}/index.html`;

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
		super('ts:pulumi:r.no.ms', name, args, opts);

		const zone = aws.route53.getZone(
			{
				name: 'no.ms.',
			},
			{ parent: this }
		);

		const domain = [
			...(args.staging ? ['staging'] : []),
			'r.no.ms',
		].join('.');

		this.site = new Website(
			`${name}_r.no.ms`,
			{
				noCostAllocationTag: true,
				index: indexDocument,
				notFound: indexDocument,
				directory: websiteBuildDirectory,
				zoneId: zone.then(zone => zone.zoneId),
				domain,
				noIndex: args.staging,
				email: false,
				tags: args.tags,
			},
			{ parent: this }
		);
	}
}
