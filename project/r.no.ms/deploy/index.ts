import * as Pulumi from '@pulumi/pulumi';
import Website from 'ts/pulumi/lib/website';

export interface Args {
	zoneId: Pulumi.Input<string>;
	domain: string;
	noIndex: boolean;
}

export class RNoMs extends Pulumi.ComponentResource {
	site: Website;
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('project:r.no.ms:deploy', name, args, opts);

		this.site = new Website(
			`${name}_zemn_me`,
			{
				index: 'project/r.no.ms/out/index.html',
				notFound: 'project/r.no.ms/out/404.html',
				directory: 'project/r.no.ms/out',
				zoneId: args.zoneId,
				domain: args.domain,
				noIndex: args.noIndex,
			},
			{ parent: this }
		);

		super.registerOutputs({ site: this.site });
	}
}
