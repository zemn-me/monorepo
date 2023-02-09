import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { distribution } from 'ts/pulumi/im/shadwell/thomas/cloudfront';
import { zone } from 'ts/pulumi/im/shadwell/zone';

export const A: aws.route53.Record = new aws.route53.Record('A_shadwell.im', {
	name: pulumi.interpolate`thomas.${zone.name}`,
	zoneId: zone.zoneId,
	type: 'A',
	aliases: [
		{
			name: distribution.domainName,
			zoneId: distribution.hostedZoneId,
			evaluateTargetHealth: true,
		},
	],
});

// this is here cause I made a mistake
export const A_2: aws.route53.Record = new aws.route53.Record(
	'A_thomas.shadwell.im',
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
