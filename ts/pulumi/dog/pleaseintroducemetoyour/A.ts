import * as aws from '@pulumi/aws';
import { zone } from './zone';
import { distribution } from './cloudfront';

export const A: aws.route53.Record = new aws.route53.Record(
	'A_pleaseintroducemetoyour.dog',
	{
		name: zone.name,
		zoneId: zone.zoneId,
		type: 'A',
		aliases: [
			{
				name: distribution.domainName,
				zoneId: distribution.hostedZoneId,
				evaluateTargetHealth: true,
			},
		],
	}
);
