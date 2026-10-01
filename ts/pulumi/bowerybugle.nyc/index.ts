import * as aws from '@pulumi/aws';
import * as Pulumi from '@pulumi/pulumi';

import Website from '#root/ts/pulumi/lib/website/website.js';

import { Backend } from './backend.js';

export interface Args {
	staging: boolean;
	bootstrapZoneId: Pulumi.Input<string>;
	/** Enable only after the external registrar delegates the .nyc zone. */
	customDomainReady?: boolean;
	tags?: Pulumi.Input<Record<string, Pulumi.Input<string>>>;
}

export class Component extends Pulumi.ComponentResource {
	readonly site: Website;
	readonly zone?: aws.route53.Zone;
	readonly domain: string;

	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:bowerybugle.nyc', name, args, opts);

		// Route 53 supports DNS for .nyc, but cannot register the domain.
		// Keep certificate validation on delegated DNS until purchase is complete.
		this.zone = args.staging
			? undefined
			: new aws.route53.Zone(
					`${name}_zone`,
					{ name: 'bowerybugle.nyc', tags: args.tags },
					{ parent: this, protect: true, retainOnDelete: true }
				);
		const useCustomDomain =
			!args.staging && args.customDomainReady === true;
		this.domain = args.staging
			? 'bowerybugle.staging.zemn.me'
			: useCustomDomain
				? 'bowerybugle.nyc'
				: 'bowerybugle.zemn.me';
		const zoneId =
			useCustomDomain && this.zone
				? this.zone.zoneId
				: args.bootstrapZoneId;
		const backend = new Backend(
			`${name}_backend`,
			{
				domain: this.domain,
				zoneId,
				staging: args.staging,
				tags: args.tags,
			},
			{ parent: this }
		);
		const directory = 'ts/pulumi/bowerybugle.nyc/public';
		this.site = new Website(
			`${name}_website`,
			{
				directory,
				apiDomain: backend.domain,
				index: `${directory}/index.html`,
				notFound: `${directory}/404.html`,
				domain: this.domain,
				zoneId:
					useCustomDomain && this.zone
						? this.zone.zoneId
						: args.bootstrapZoneId,
				noIndex: args.staging || !useCustomDomain,
				noCostAllocationTag: true,
				email: false,
				tags: args.tags,
			},
			{ parent: this }
		);
		this.registerOutputs({
			domain: this.domain,
			nameServers: this.zone?.nameServers,
		});
	}
}
