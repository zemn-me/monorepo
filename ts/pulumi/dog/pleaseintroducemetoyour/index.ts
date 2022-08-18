import * as aws from '@pulumi/aws';
import Public from 'monorepo/ts/pulumi/dog/pleaseintroducemetoyour/public';
export * as Public from 'monorepo/ts/pulumi/dog/pleaseintroducemetoyour/public';

export const zone = new aws.route53.Zone(
	'pleaseintroducemetoyour.dog',
	{
		comment: 'HostedZone created by Route53 Registrar',
		name: 'pleaseintroducemetoyour.dog',
	},
	{
		protect: true,
	}
);

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

export default zone;
