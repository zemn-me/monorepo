import * as aws from '@pulumi/aws';
import { bucket } from 'ts/pulumi/dog/pleaseintroducemetoyour/public';

import * as cert from './cert';
import { zone } from './zone';

const s3OriginId = 'myS3Origin';
export const distribution: aws.cloudfront.Distribution =
	new aws.cloudfront.Distribution('s3Distribution', {
		origins: [
			{
				domainName: bucket.bucketRegionalDomainName,
				originId: s3OriginId,
			},
		],
		enabled: true,
		isIpv6Enabled: true,
		defaultRootObject: 'index.html',
		aliases: [zone.name],
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
			acmCertificateArn: cert.validation.certificateArn,
			sslSupportMethod: 'sni-only', // idk really what this does
		},
	});
