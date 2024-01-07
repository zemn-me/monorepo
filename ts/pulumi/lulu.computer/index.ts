import * as aws from '@pulumi/aws';
import * as Pulumi from '@pulumi/pulumi';
import Website from 'ts/pulumi/lib/website';

export interface Args {
	staging: boolean;
}

export class Component extends Pulumi.ComponentResource {
	site: Website;
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:lulu.computer', name, args, opts);

		const zone = new aws.route53.Zone(`${name}_zone`, {});

		const domain = new aws.route53domains.RegisteredDomain(
			`${name}_domain`,
			{
				domainName: 'lulu.computer',
				nameServers: zone.nameServers.apply(servers =>
					servers.map(name => ({ name }))
				),
			}
		);

		this.site = new Website(`${name}_lulu.computer`, {
			index: 'ts/pulumi/lulu.computer/out/index.html',
			notFound: 'ts/pulumi/lulu.computer/out/index.html',
			directory: 'ts/pulumi/lulu.computer/out',
			zoneId: zone.id,
			domain: domain.domainName.apply(domainName =>
				[...(args.staging ? ['staging'] : []), domainName].join('.')
			),
			noIndex: args.staging,
		});
	}
}
