import * as staticwebsite from '@pulumi/aws-static-website';
import * as asset from '@pulumi/pulumi/asset';
import * as cert from 'ts/pulumi/im/shadwell/cert';

export const site = new staticwebsite.Website('thomas.shadwell.im', {
	withCDN: true,
	indexHTML: new asset.FileAsset(
		'ts/pulumi/im/shadwell/thomas/public/index.html'
	).path,
	sitePath: 'ts/pulumi/im/shadwell/thomas/public',
	targetDomain: 'thomas.shadwell.im',
	certificateARN: cert.arn,
});
