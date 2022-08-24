import * as aws from '@pulumi/aws';

export const zone = new aws.route53.Zone(
	'shadwell.im',
	{
		comment: 'HostedZone created by Route53 Registrar',
		forceDestroy: false,
		name: 'shadwell.im',
	},
	{
		protect: true,
	}
);

export default zone;
