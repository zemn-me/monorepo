import * as aws from '@pulumi/aws';
import pulumi from '@pulumi/pulumi';

import { zone as shadwell_im } from 'monorepo/ts/pulumi/im/shadwell/zone';

export const zone = new aws.route53.Zone('thomas.shadwell.im', {
	comment: 'HostedZone created by Route53 Registrar',
	name: pulumi.interpolate`thomas.${shadwell_im.name}`,
});
