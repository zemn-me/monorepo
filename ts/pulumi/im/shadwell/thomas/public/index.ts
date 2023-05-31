import * as staticwebsite from '@pulumi/aws-static-website';
import * as cert from 'ts/pulumi/im/shadwell/cert';

export const site = new staticwebsite.Website('thomas.shadwell.im', {
	withCDN: true,
	indexHTML: 'index.html',
	sitePath: 'ts/pulumi/im/shadwell/thomas/public',
	targetDomain: 'thomas.shadwell.im',
	certificateARN: cert.arn,
});
