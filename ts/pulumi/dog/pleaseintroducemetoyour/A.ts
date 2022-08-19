
import * as aws from '@pulumi/aws';
import { zone } from './zone'
import Public from 'monorepo/ts/pulumi/dog/pleaseintroducemetoyour/public';

export const A = new aws.route53.Record('A_pleaseintroducemetoyour.dog', {
	name: zone.name,
	zoneId: zone.zoneId,
	type: 'A',
	aliases: [
		{
			name: Public.websiteDomain,
			zoneId: Public.hostedZoneId,
			evaluateTargetHealth: true,
		},
	],
});

