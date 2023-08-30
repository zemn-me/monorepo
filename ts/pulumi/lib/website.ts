import fs from 'node:fs';
import path from 'node:path';

import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import mime from 'mime';
import * as guard from 'ts/guard';
import Certificate from 'ts/pulumi/lib/certificate';

const bucketSuffix = '-bucket';
const pulumiRandomChars = 7;
const bucketNameMaximumLength = 56 - pulumiRandomChars - bucketSuffix.length;

// bucket has a maximum length of 63 (56 minus the 7 random chars that Pulumi adds)
const deriveBucketName = (base: string) =>
	[...base.replace(/[^a-z0-9.]/g, '-')]
		.slice(0, bucketNameMaximumLength - 1)
		.join('') + bucketSuffix;

function relative(from: string, to: string): string {
	const f = path.normalize(from),
		t = path.normalize(to);

	if (!t.startsWith(f)) {
		// try to remove as much of the prefix as possible.

		const [tl, fl] = [[...t], [...f]];

		let ctr = 0;

		for (; tl[ctr] === fl[ctr]; ctr++);

		let errorMessage = `Cannot make ${t} relative to ${f}; ${t} does not start with ${f}.`;

		errorMessage += `The issue starts after '${tl.slice(ctr).join('')}'.`;

		throw new Error(errorMessage);
	}

	return path.relative(f, t);
}

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
	 * A directory to upload to the S3 bucket.
	 */
	directory: string;

	/**
	 * The index document to serve.
	 */
	index: string;

	/**
	 * The 404 document to serve.
	 */
	notFound?: string;

	/**
	 * Prevent search engines from indexing.
	 */
	noIndex: boolean;
}

/**
 * Provisions an S3 Bucket, CloudFront instance and certificate
 * to serve a static website.
 */
export class Website extends pulumi.ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:lib:Website', name, args, opts);

		const certificate = new Certificate(
			`${name}_certificate`,
			{
				zoneId: args.zoneId,
				domain: args.domain,
			},
			{ parent: this }
		);

		/**
		 * The final subdomain that the website can be loaded from on the target domain.
		 */

		const indexDocument = relative(args.directory, args.index);
		const errorDocument = args.notFound
			? relative(args.directory, args.notFound)
			: undefined;

		const bucket = new aws.s3.Bucket(
			deriveBucketName(name),
			{
				website: {
					indexDocument,
					errorDocument,
				},
			},
			{
				parent: this,
			}
		);

		// upload files

		const uploadDir = (dir: string): Map<string, aws.s3.BucketObject> => {
			let out: Map<string, aws.s3.BucketObject> = new Map();
			for (const item of fs.readdirSync(dir)) {
				/**
				 * The absolute path on disk.
				 */
				const fPath = path.join(dir, item);

				const fileInfo = fs.lstatSync(fPath);

				if (fileInfo.isDirectory()) {
					out = new Map([...out, ...uploadDir(fPath)]);
					continue;
				}

				out.set(
					fPath,
					new aws.s3.BucketObject(
						`${name}_bucket_file_${fPath}`,
						{
							key: relative(args.directory, fPath),
							bucket: bucket.id,
							contentType: guard.must(
								guard.isNotNull,
								() => `couldn't get contentType of ${fPath}`
							)(mime.getType(fPath)),
							source: new pulumi.asset.FileAsset(fPath),
						},
						{
							parent: this,
						}
					)
				);
			}

			return out;
		};

		const objects = uploadDir(args.directory);

		const errorDocumentObject = args.notFound
			? guard.must(
					guard.isDefined,
					() =>
						`Cannot find ${args.notFound} in [${[
							...objects.keys(),
						].join(', ')}]`
			  )(objects.get(args.notFound))
			: undefined;
		const indexDocumentObject = guard.must(
			guard.isDefined,
			() =>
				`Cannot find ${args.index} in [${[...objects.keys()].join(
					', '
				)}]`
		)(objects.get(args.index));

		const originAccessIdentity = new aws.cloudfront.OriginAccessIdentity(
			`${name}_origin_access_identity`,
			{
				comment:
					'this is needed to setup s3 polices and make s3 not public.',
			},
			{
				parent: this,
			}
		);

		// Only allow cloudfront to access content bucket.
		const bucketPolicy = new aws.s3.BucketPolicy(
			`${name}_bucket_policy`,
			{
				bucket: bucket.id, // refer to the bucket created earlier
				policy: pulumi
					.all([originAccessIdentity.iamArn, bucket.arn])
					.apply(([oaiArn, bucketArn]) =>
						JSON.stringify({
							Version: '2012-10-17',
							Statement: [
								{
									Effect: 'Allow',
									Principal: {
										AWS: oaiArn,
									}, // Only allow Cloudfront read access.
									Action: ['s3:GetObject', 's3:ListBucket'],
									Resource: [`${bucketArn}/*`], // Give Cloudfront access to the entire bucket.
								},
							],
						})
					),
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

		// create the cloudfront

		const distribution = new aws.cloudfront.Distribution(
			`${name}_cloudfront_distribution`,
			{
				origins: [
					{
						s3OriginConfig: {
							originAccessIdentity:
								originAccessIdentity.cloudfrontAccessIdentityPath,
						},
						domainName: bucket.bucketRegionalDomainName,
						originId: `${name}_cloudfront_distribution`,
					},
				],
				enabled: true,
				isIpv6Enabled: true,
				defaultRootObject: indexDocumentObject.key,
				// this is the host that the distribution will expect
				// (other than the default).
				aliases: [args.domain],
				// in the future we could maybe take a bunch of these as args, but
				// we're not overengineering today!
				// im sorry this bit kinda sucks
				...(errorDocumentObject !== undefined
					? {
							customErrorResponses: [
								{
									errorCode: 404,
									responseCode: 404,
									responsePagePath: errorDocumentObject.key,
								},
							],
					  }
					: {}),
				defaultCacheBehavior: {
					responseHeadersPolicyId: responseHeadersPolicy.id,
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
					targetOriginId: `${name}_cloudfront_distribution`,
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
				},
				restrictions: {
					geoRestriction: {
						restrictionType: 'none',
					},
				},
				tags: {
					Environment: 'production',
				},
				viewerCertificate: {
					// important to use this so that it waits for the cert
					// to come up
					acmCertificateArn: certificate.validation.certificateArn,
					sslSupportMethod: 'sni-only', // idk really what this does
				},
			},
			// creating CloudFront Distribution: CNAMEAlreadyExists: One or more of the CNAMEs you provided are already associated with a different resource.
			{ parent: this, deleteBeforeReplace: true }
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
						name: distribution.domainName,
						zoneId: distribution.hostedZoneId,
						evaluateTargetHealth: true,
					},
				],
			},
			// records must be unique
			{ parent: this, deleteBeforeReplace: true }
		);

		this.registerOutputs({
			distribution,
			record,
			bucketPolicy,
		});
	}
}

export default Website;
