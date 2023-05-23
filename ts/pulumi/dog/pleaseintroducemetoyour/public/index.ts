import * as staticwebsite from '@pulumi/aws-static-website';
import * as asset from '@pulumi/pulumi/asset';
import * as cert from 'ts/pulumi/dog/pleaseintroducemetoyour/cert';

export const site = new staticwebsite.Website('pleaseintroducemetoyour.dog', {
	withCDN: true,
	indexHTML: new asset.FileAsset(
		'ts/pulumi/dog/pleaseintroducmetoyour/public/static/out/index.html'
	).path,
	error404: new asset.FileAsset(
		'ts/pulumi/dog/pleaseintroducemetoyour/public/static/out/404.html'
	).path,
	sitePath: 'ts/pulumi/dog/pleaseintroducemetoyour/public/static/out',
	targetDomain: 'pleaseintroducemetoyour.dog',
	certificateARN: cert.arn,
});
