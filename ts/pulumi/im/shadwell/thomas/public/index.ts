import * as zone from 'ts/pulumi/im/shadwell/zone';
import Website from 'ts/pulumi/lib/website';

export const site = new Website('thomas.shadwell.im', {
	index: 'ts/pulumi/im/shadwell/thomas/public/index.html',
	directory: 'ts/pulumi/im/shadwell/thomas/public',
	zone: zone.zone,
	subDomain: 'thomas',
});
