import * as aws from '@pulumi/aws';

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
