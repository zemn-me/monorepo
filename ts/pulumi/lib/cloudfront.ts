import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { aliases } from 'ts/pulumi/aliases';
import Certificate from 'ts/pulumi/lib/certificate';

// where we will fit any dynamic config entries.
// this is so typescriptm will error if we don't override
// this property.
const hole: symbol = Symbol();

const cacheBehaviorDefaultProperties = {
	responseHeadersPolicyId: hole,
	// i dont think we use most of these but it's probably not
	// important
	allowedMethods: [
		'DELETE',
		'GET',
		'HEAD',
		'OPTIONS',
		'PATCH',
		'POST',
		'PUT',
	],
	cachedMethods: ['GET', 'HEAD'],
	// i'm fairly sure this is correct, but the docs kinda suck
	// on which of AWS's many IDs this might be and sapling histgrep
	// is broken.
	forwardedValues: {
		queryString: false,
		// I'm not using cookies for anything yet.
		// and to be honest, i prefer localStorage.
		cookies: {
			forward: 'none',
		},
	},
	viewerProtocolPolicy: 'redirect-to-https',
	minTtl: 0,
	defaultTtl: 3600,
	maxTtl: 86400,
};

cacheBehaviorDefaultProperties satisfies Partial<{
	[k in keyof aws.types.input.cloudfront.DistributionDefaultCacheBehavior]:
		| aws.types.input.cloudfront.DistributionDefaultCacheBehavior[k]
		| typeof hole;
}>;

const baseProperties = {
	enabled: true,
	isIpv6Enabled: true,
	aliases: hole,
	restrictions: {
		geoRestriction: {
			restrictionType: 'none',
		},
	},
	tags: {
		Environment: 'production',
	},
	viewerCertificate: hole,
	defaultCacheBehavior: cacheBehaviorDefaultProperties,
};

baseProperties satisfies Omit<
	Partial<{
		[k in keyof aws.cloudfront.DistributionArgs]:
			| aws.cloudfront.DistributionArgs[k]
			| typeof hole;
	}>,
	'defaultCacheBehavior'
>;

export interface Args {
	/**
	 * Zone to create any needed DNS records in.
	 */
	zoneId: pulumi.Input<string>;

	/**
	 * The domain or subdomain itself in which to create the website.
	 *
	 * Leave undefined to host at the root of the domain
	 *
	 * @example
	 * "mywebsite.com."
	 */
	domain: string;

	/**
	 * Prevent search engines from indexing.
	 */
	noIndex: boolean;

	distributionArgs: Omit<
		aws.cloudfront.DistributionArgs,
		keyof typeof baseProperties
	> & {
		// not traditionally optional, but we provide a default.
		defaultCacheBehavior: Omit<
			aws.types.input.cloudfront.DistributionDefaultCacheBehavior,
			keyof typeof cacheBehaviorDefaultProperties
		>;
	};
}

/**
 * Provision a CloudFront instance at a given domain,
 * including the certificate needed to serve at that domain.
 *
 * Also configures some basic housekeeping, like security headers.
 */
export class CloudFront extends pulumi.ComponentResource {
	distribution: aws.cloudfront.Distribution;
	constructor(
		name: string,
		args: Args,
		opts?: pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:lib:CloudFront', name, args, opts);

		const certificate = new Certificate(
			`${name}_certificate`,
			{
				zoneId: args.zoneId,
				domain: args.domain,
			},
			{ parent: this }
		);

		// response headers policy (http headers)
		const responseHeadersPolicy = new aws.cloudfront.ResponseHeadersPolicy(
			`${name}_response_headers`.replaceAll('.', '-'),
			{
				securityHeadersConfig: {
					contentTypeOptions: {
						override: false,
					},
					frameOptions: {
						frameOption: 'DENY',
						override: false,
					},
					strictTransportSecurity: {
						accessControlMaxAgeSec: 31536000,
						override: false,
						includeSubdomains: true,
						preload: true,
					},
				},
				customHeadersConfig: {
					items: [
						...(args.noIndex
							? [
									{
										header: 'x-robots-tag',
										value: 'noindex',
										override: false,
									},
							  ]
							: []),
					],
				},
			}
		);

		const cloudfrontDistributionName = `${name}_cloudfront_distribution`;
		// create the cloudfront
		this.distribution = new aws.cloudfront.Distribution(
			cloudfrontDistributionName,
			{
				...args.distributionArgs,
				...baseProperties,
				// this is the host that the distribution will expect
				// (other than the default).
				aliases: [args.domain],
				// in the future we could maybe take a bunch of these as args, but
				// we're not overengineering today!
				// im sorry this bit kinda sucks
				defaultCacheBehavior: {
					...cacheBehaviorDefaultProperties,
					...args.distributionArgs.defaultCacheBehavior,
					responseHeadersPolicyId: responseHeadersPolicy.id,
				},
				viewerCertificate: {
					// important to use this so that it waits for the cert
					// to come up
					acmCertificateArn: certificate.validation.certificateArn,
					sslSupportMethod: 'sni-only', // idk really what this does
				},
			},
			// delete before replace due to resource contention ->
			// creating CloudFront Distribution: CNAMEAlreadyExists:
			// One or more of the CNAMEs you provided are already associated with a different resource.
			{
				parent: this,
				deleteBeforeReplace: true,
				aliases: aliases[cloudfrontDistributionName],
			}
		);

		// create the alias record that allows the distribution to be located
		// from the DNS record.

		const record = new aws.route53.Record(
			`${name}_distribution_record`,
			{
				zoneId: args.zoneId,
				name: args.domain,
				type: 'A',
				aliases: [
					{
						name: this.distribution.domainName,
						zoneId: this.distribution.hostedZoneId,
						evaluateTargetHealth: true,
					},
				],
			},
			// This needs to be deleted before it is replaced, because
			// the names of these proof records are unique --
			// if we try to create a new version of this record
			// first, aws will complain it already exists
			{ parent: this, deleteBeforeReplace: true }
		);

		this.registerOutputs({
			distribution: this.distribution,
			record,
		});
	}
}

export default CloudFront;
