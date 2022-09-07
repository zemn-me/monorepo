import * as aws from '@pulumi/aws';

import { distribution } from './cloudfront';
import { zone } from './zone';

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
