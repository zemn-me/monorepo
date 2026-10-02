import * as aws from '@pulumi/aws';
import * as Pulumi from '@pulumi/pulumi';

import Website from '#root/ts/pulumi/lib/website/website.js';

import { Backend } from './backend.js';
import { Registrar, type Registration } from './registrar.js';

export interface Args {
	staging: boolean;
	bootstrapZoneId: Pulumi.Input<string>;
	registration?: Registration;
	/** Use the .nyc hostname; DNS records wait for registrar delegation. */
	customDomainReady?: boolean;
	tags?: Pulumi.Input<Record<string, Pulumi.Input<string>>>;
}

export class Component extends Pulumi.ComponentResource {
	readonly site: Website;
	readonly zone?: aws.route53.Zone;
	readonly domain: string;
	readonly registrar?: Registrar;

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
		if (this.zone) {
			this.registrar = new Registrar(
				`${name}_registrar`,
				{
					registration: args.registration,
					nameServers: this.zone.nameServers,
				},
				{ parent: this }
			);
		}
		const useCustomDomain =
			!args.staging && args.customDomainReady === true;
		this.domain = args.staging
			? 'bowerybugle.staging.zemn.me'
			: useCustomDomain
				? 'bowerybugle.nyc'
				: 'bowerybugle.zemn.me';
		// DNS validation must wait for registration and delegation, even when
		// the custom hostname is enabled in the same deployment as purchase.
		const customZoneId =
			this.zone && this.registrar?.delegation
				? Pulumi.all([
						this.zone.zoneId,
						this.registrar.delegation.id,
					]).apply(([zoneId]) => zoneId)
				: this.zone?.zoneId;
		const zoneId =
			useCustomDomain && customZoneId
				? customZoneId
				: args.bootstrapZoneId;
		new Backend(
			`${name}_backend`,
			{
				domain: this.domain,
				zoneId,
				staging: args.staging,
				tags: args.tags,
			},
			{ parent: this }
		);
		const directory = 'project/nyc/bowerybugle/build';
		this.site = new Website(
			`${name}_website`,
			{
				directory,
				index: `${directory}/index.html`,
				notFound: `${directory}/404.html`,
				domain: this.domain,
				zoneId,
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
