import * as aws from '@pulumi/aws';

export const shadwell_im = new aws.route53.Zone(
	'shadwell.im',
	{
		comment: 'HostedZone created by Route53 Registrar',
		name: 'shadwell.im',
	},
	{
		protect: true,
	}
);

export default shadwell_im;
