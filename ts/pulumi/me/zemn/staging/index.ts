import * as zone from 'ts/pulumi/me/zemn/zone';
import Website from 'ts/pulumi/lib/website'

export const site = new Website('staging.zemn.me', {
	index: 'project/zemn.me/next/out/index.html',
	notFound: 'project/zemn.me/next/out/404.html',
	directory: 'project/zemn.me/next/out',
	zone: zone.zone,
	subDomain: 'staging'
});
