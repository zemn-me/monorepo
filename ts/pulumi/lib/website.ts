import fs from 'node:fs';
import path from 'node:path';

import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import mime from 'mime';
import * as guard from 'ts/guard';
import CloudFront from 'ts/pulumi/lib/cloudfront';

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
							source: fPath,
							// wait to be allowed to add stuff to this bucket with public
							// access.
							//
							// see: https://github.com/pulumi/pulumi-aws-static-website/blob/main/provider/cmd/pulumi-resource-aws-static-website/website.ts#L278
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
									Action: ['s3:GetObject'],
									Resource: [`${bucketArn}/*`], // Give Cloudfront access to the entire bucket.
								},
							],
						})
					),
			},
			{ parent: this }
		);

		// create the cloudfront

		// create the cloudfront distribution and cert
		const cloudFront = new CloudFront(
			`${name}_cloudfront`,
			{
				zoneId: args.zoneId,
				domain: args.domain,
				noIndex: args.noIndex,
				distributionArgs: {
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

					defaultCacheBehavior: {
						targetOriginId: `${name}_cloudfront_distribution`,
					},

					defaultRootObject: indexDocumentObject.key,

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
						  // records must be unique
						: {}),
				},
			},
			// records must be unique
			{ parent: this }
		);

		this.registerOutputs({
			cloudFront,
			bucketPolicy,
		});
	}
}

export default Website;
