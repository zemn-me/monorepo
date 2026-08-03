/**
 * @fileoverview
 *
 * the model generated it
 */

import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

import { deriveBucketName } from '#root/ts/pulumi/lib/bucketName.js';
import Certificate from '#root/ts/pulumi/lib/certificate.js';
import { mergeTags, tagTrue } from '#root/ts/pulumi/lib/tags.js';

export interface Args {
	/**
	 * Zone to create the DNS record in.
	 */
	zoneId: pulumi.Input<string>;

	/**
	 * Domain name to serve this redirect from (e.g. "example.com").
	 */
	domain: pulumi.Input<string>;

	/**
	 * Absolute URL to redirect to (e.g. "https://example.com").
	 */
	redirectTo: pulumi.Input<string>;

	tags?: pulumi.Input<Record<string, pulumi.Input<string>>>;
}

/**
 * A redirect-only CloudFront distribution for a domain.
 *
 * Uses an S3 Website redirect rule as the origin.
 */
export class HTTPRedirect extends pulumi.ComponentResource {
	distribution: aws.cloudfront.Distribution;
	record: aws.route53.Record;

	constructor(
		name: string,
		args: Args,
		opts?: pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:lib:HTTPRedirect', name, args, opts);

		const tags = mergeTags(args.tags, tagTrue(name));

		const certificate = new Certificate(
			`${name}_certificate`,
			{
				zoneId: args.zoneId,
				domain: args.domain,
				noCostAllocationTag: true,
				tags,
			},
			{ parent: this }
		);

		// CloudFront needs an origin; use an S3 website endpoint that always redirects.
		const bucket = new aws.s3.BucketV2(
			deriveBucketName(name),
			{ tags },
			{ parent: this }
		);

		new aws.s3.BucketPublicAccessBlock(
			`${name}_public_access_block`,
			{
				bucket: bucket.id,
				blockPublicAcls: false,
				blockPublicPolicy: false,
				ignorePublicAcls: false,
				restrictPublicBuckets: false,
			},
			{ parent: this }
		);

		new aws.s3.BucketPolicy(
			`${name}_bucket_policy`,
			{
				bucket: bucket.id,
				policy: bucket.arn.apply(bucketArn =>
					JSON.stringify({
						Version: '2012-10-17',
						Statement: [
							{
								Effect: 'Allow',
								Action: ['s3:GetObject'],
								Principal: '*',
								Resource: [`${bucketArn}/*`],
							},
						],
					})
				),
			},
			{ parent: this }
		);

		const redirectInfo = pulumi.output(args.redirectTo).apply(url => {
			const u = new URL(url);
			const protocol = u.protocol.replace(':', '');

			if (protocol !== 'http' && protocol !== 'https') {
				throw new Error(
					`redirectTo must be an http(s) URL; got protocol '${u.protocol}' for '${url}'.`
				);
			}

			return { host: u.host, protocol };
		});

		const website = new aws.s3.BucketWebsiteConfigurationV2(
			`${name}_website`,
			{
				bucket: bucket.bucket,
				routingRules: [
					{
						redirect: {
							hostName: redirectInfo.apply(v => v.host),
							protocol: redirectInfo.apply(v => v.protocol),
							httpRedirectCode: '302',
						},
					},
				],
			},
			{ parent: this }
		);

		this.distribution = new aws.cloudfront.Distribution(
			`${name}_cloudfront_distribution`,
			{
				origins: [
					{
						customOriginConfig: {
							originProtocolPolicy: 'http-only',
							httpPort: 80,
							httpsPort: 443,
							originSslProtocols: ['TLSv1.2'],
						},
						domainName: website.websiteEndpoint,
						originId: `${name}_cloudfront_distribution`,
					},
				],
				enabled: true,
				isIpv6Enabled: true,
				aliases: [args.domain],
				defaultCacheBehavior: {
					compress: true,
					allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
					cachedMethods: ['GET', 'HEAD'],
					targetOriginId: `${name}_cloudfront_distribution`,
					forwardedValues: {
						queryString: true,
						cookies: { forward: 'none' },
					},
					viewerProtocolPolicy: 'redirect-to-https',
					minTtl: 0,
					defaultTtl: 0,
					maxTtl: 0,
				},
				restrictions: {
					geoRestriction: { restrictionType: 'none' },
				},
				tags,
				viewerCertificate: {
					acmCertificateArn: certificate.validation.certificateArn,
					sslSupportMethod: 'sni-only',
				},
			},
			{ parent: this, deleteBeforeReplace: true }
		);

		this.record = new aws.route53.Record(
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
			{ parent: this, deleteBeforeReplace: true }
		);

		this.registerOutputs({
			distribution: this.distribution,
			record: this.record,
		});
	}
}

export default HTTPRedirect;
