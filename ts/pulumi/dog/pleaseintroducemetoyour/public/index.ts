import * as zone from 'ts/pulumi/dog/pleaseintroducemetoyour/zone';
import Website from 'ts/pulumi/lib/website'

export const site = new Website('pleaseintroducemetoyour.dog', {
	index: 'ts/pulumi/dog/pleaseintroducmetoyour/public/static/out/index.html',
	notFound: 'ts/pulumi/dog/pleaseintroducemetoyour/public/static/out/404.html',
	directory: 'ts/pulumi/dog/pleaseintroducemetoyour/public/static/out',
	zone: zone.zone,
	subDomain: undefined
});
