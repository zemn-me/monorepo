import { route53 } from "@pulumi/aws";
import { ComponentResource, ComponentResourceOptions, Input } from "@pulumi/pulumi";

export interface Args {
	/**
	 * Zone to create any needed DNS records in.
	 */
	zoneId: Input<string>;

	/**
	 * The bluesky displayname to claim.
	 */
	displayname: Input<string>;

	/**
	 * The unique user ID to give the displaynama to.
	 * Can be found at https://bsky.app/settings.
	 *
	 * NB: leave off the `did=`.
	 */
	did: `did:plc:${string}`
}

/**
 * Provisions an S3 Bucket, CloudFront instance and certificate
 * to serve a static website.
 */
export class BlueskyDisplayNameClaim extends ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: ComponentResourceOptions
	) {
		super('ts:pulumi:lib:BlueskyDisplayNameClaim', name, args, opts);

		const record = new route53.Record(
			`${name}_txt_record`,
			{
				zoneId: args.zoneId,
				name: ["_atproto", args.displayname].join("."),
				type: "TXT",
				records: [
					`did=${args.did}`
				],
				ttl: 300
			},
			{ parent: this, protect: false }
		)

		this.registerOutputs({
			record
		});
	}
}

