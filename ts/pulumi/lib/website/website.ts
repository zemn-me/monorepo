import fs from 'node:fs';
import path from 'node:path';

import * as aws from '@pulumi/aws';
import { ResponseHeadersPolicy } from '@pulumi/aws/cloudfront';
import { CostAllocationTag } from '@pulumi/aws/costexplorer/index.js';
import * as pulumi from '@pulumi/pulumi';
import mime from 'mime';

import * as guard from '#root/ts/guard.js';
import { deriveBucketName } from '#root/ts/pulumi/lib/bucketName.js';
import Certificate from '#root/ts/pulumi/lib/certificate.js';
import { S3ExpireOnDeletePolicy } from '#root/ts/pulumi/lib/expire_on_delete/expire_on_delete.js';
import { mergeTags, tagTrue } from '#root/ts/pulumi/lib/tags.js';

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
	domain: pulumi.Input<string>;

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

	/**
	 * Don't deploy a cost allocation tag.
	 * AWS doesn't let you do this in one go.
	 */
	noCostAllocationTag?: boolean

	tags?: pulumi.Input<Record<string, pulumi.Input<string>>>;

	/**
	 * Whether to set up email for this website.
	 */
	email: boolean

	/**
	 * Other TXT records to attach to the domain.
	 */
	otherTXTRecords?: string[]
}

let noRobotsResponseHeadersPolicyCache: ResponseHeadersPolicy;
let robotsResponseHeadersPolicyCache: ResponseHeadersPolicy;

function noRobotsResponseHeadersPolicy() {
	if (typeof noRobotsResponseHeadersPolicyCache == "undefined") {
		noRobotsResponseHeadersPolicyCache = responseHeadersPolicy(
			"norobotsresponsepolicy",
			true
		)
	}

	return noRobotsResponseHeadersPolicyCache
}

function robotsResponseHeadersPolicy() {
	if (typeof robotsResponseHeadersPolicyCache == "undefined") {
		robotsResponseHeadersPolicyCache = responseHeadersPolicy(
			"robotsresponsepolicy",
			false
		)
	}

	return robotsResponseHeadersPolicyCache;
}

function responseHeadersPolicy(name: string, noIndex: boolean) {
		return new aws.cloudfront.ResponseHeadersPolicy(
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
						...(noIndex
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
		const tag = name;
		const tags = mergeTags(args.tags, tagTrue(tag));

		if (!args.noCostAllocationTag) new CostAllocationTag(
			`${name}_cost_tag`,
			{
				status: 'Active',
				tagKey: tag,
			},
			{ parent: this }
		);

		const certificate = new Certificate(
			`${name}_certificate`,
			{
				zoneId: args.zoneId,
				domain: args.domain,
				noCostAllocationTag: args.noCostAllocationTag,
				tags: tags,
			},
			{ parent: this }
		);

		/**
		 * The final subdomain that the website can be loaded from on the target domain.
		 */
		const bucket = new aws.s3.BucketV2(
			deriveBucketName(name),
			{
				tags,

			},
			{
				parent: this,
			}
		);

		new S3ExpireOnDeletePolicy(`${name}_expire_on_delete`, {
			bucketId: bucket.id,
			expirationDays: 20,
		}, { parent: this })

		// upload files

		const getS3Key = (dest: string) => {
			// x.html files should be served without the .html extension.
			const htmlExt = '.html';

			if (dest.endsWith(htmlExt)) {
				dest = dest.slice(0, -htmlExt.length);
			}
			return dest;
		};

		const uploadDir = (dir: string): Map<string, aws.s3.BucketObjectv2> => {
			let out: Map<string, aws.s3.BucketObjectv2> = new Map();
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

				const source = new pulumi.asset.FileAsset(fPath);

				out.set(
					fPath,
					new aws.s3.BucketObjectv2(
						`${name}_bucket_file_${fPath}`,
						{
							key: getS3Key(relative(args.directory, fPath)),
							bucket: bucket.id,
							contentType: guard.must(
								guard.isNotNull,
								() => `couldn't get contentType of ${fPath}`
							)(mime.getType(fPath)),
							source,
							tags,
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

		objects.set(
			'security.txt',
			new aws.s3.BucketObjectv2(
				`${name}_security_txt`,
				{
					key: getS3Key('.well-known/security.txt'),
					bucket: bucket.id,
					contentType: 'text/plain',
					source: new pulumi.asset.FileAsset(
						'ts/pulumi/lib/website/security.txt'
					),
					tags,
				},
				{ parent: this }
			)
		);

		// note that below we don't use the getS3Key version,
		// as they are indexed by their on-disk paths.
		const errorDocumentObject = args.notFound
			? guard.must(
					guard.isDefined,
					() =>
						`Cannot find ${getS3Key(args.notFound!)} in [${[
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
									Action: ['s3:ListBucket'],
									Principal: {
										AWS: oaiArn,
									},
									Resource: [bucketArn],
								},
								{
									Effect: 'Allow',
									Principal: {
										AWS: oaiArn,
									}, // Only allow Cloudfront read access.
									Action: ['s3:GetObject'],
									Resource: [`${bucketArn}/*`], // Give Cloudfront access to the entire bucket.
								},
							],
						})
					),
			},
			{ parent: this }
		);

		// response headers policy (http headers)
		const responseHeadersPolicy =
			args.noIndex
				? noRobotsResponseHeadersPolicy()
				: robotsResponseHeadersPolicy();



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
									responsePagePath: pulumi.interpolate`/${errorDocumentObject.key}`,
								},
							],
						}
					: {}),
				defaultCacheBehavior: {
					compress: true,
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
				tags: mergeTags(tags, {
					Environment: 'production',
				}),
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

		if (args.email) {
			new aws.route53.Record(
				`${name}_dmarc_record`,
				{
					zoneId: args.zoneId,
					name: pulumi.interpolate`_dmarc.${args.domain}`,
					type: 'TXT',
					records: pulumi.output(args.domain).apply(name => [
						`v=DMARC1; p=none; rua=mailto:dmarc-reports@${name}; ruf=mailto:dmarc-failures@${name}; sp=none; adkim=s; aspf=s`,
					]),
					ttl: 300,
				},
				{ parent: this }
			);

			new aws.route53.Record(
				`${name}_mx`,
				{
					zoneId: args.zoneId,
					name: args.domain,
					type: 'MX',
					records: [
						"1 ASPMX.L.GOOGLE.COM",
						"5 ALT1.ASPMX.L.GOOGLE.COM",
						"5 ALT2.ASPMX.L.GOOGLE.COM",
						"10 ALT3.ASPMX.L.GOOGLE.COM",
						"10 ALT4.ASPMX.L.GOOGLE.COM",
					],
					ttl: 300,
				},
				{ parent: this }
			);
		}

		new aws.route53.Record(
			`${name}_txt_record`,
			{
				zoneId: args.zoneId,
				name: args.domain,
				type: 'TXT',
				records: [
					`google-site-verification=I7-1voPtMM91njshXSCMfLFPTPgY_lFFeScPYIgklRM`,
					`google-site-verification=plPeQFN6n0_8HZ8hr3HMXbYHrU_Yh5wPP9OUwH0ErGY`,
					`google-site-verification=byw27UvCg87CmNCBN_1gweAhrlxa_5TW-GDD_ht1lug`,
					`v=spf1 include:_spf.google.com ~all`,
					...args.otherTXTRecords ?? []
				],
				ttl: 1800,
			},
			{ protect: false }
		);

		this.registerOutputs({
			distribution,
			record,
			bucketPolicy,
		});
	}
}

export default Website;
