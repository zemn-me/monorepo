import * as cert from 'ts/pulumi/im/shadwell/cert';
import Website from 'ts/pulumi/lib/website';
import * as zone from 'ts/pulumi/im/shadwell/zone';

export const site = new Website('thomas.shadwell.im', {
	index: 'ts/pulumi/im/shadwell/thomas/public/index.html',
	directory: 'ts/pulumi/im/shadwell/thomas/public',
	notFound: 'ts/pulumi/im/shadwell/thomas/public/404.html',
	zone: zone.zone,
	subDomain: 'thomas'
});
