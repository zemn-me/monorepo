import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { arn as acmCertificateArn } from 'ts/pulumi/im/shadwell/cert';
import { bucket, index } from 'ts/pulumi/im/shadwell/thomas/public';
import { zone } from 'ts/pulumi/im/shadwell/zone';

const s3OriginId = 'myS3Origin';
export const distribution: aws.cloudfront.Distribution =
	new aws.cloudfront.Distribution('shadwell-im-s3-distribution', {
		origins: [
			{
				domainName: bucket.bucketRegionalDomainName,
				originId: s3OriginId,
			},
		],
		enabled: true,
		isIpv6Enabled: true,
		defaultRootObject: index.key,
		aliases: [zone.name, pulumi.interpolate`thomas.${zone.name}`],
		defaultCacheBehavior: {
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
			targetOriginId: s3OriginId,
			forwardedValues: {
				queryString: false,
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
			acmCertificateArn,
			sslSupportMethod: 'sni-only', // idk really what this does
		},
	});
