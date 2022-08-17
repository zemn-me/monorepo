import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';

export const zemn_me = new aws.route53.Zone(
	'zemn.me',
	{
		comment: '',
		name: 'zemn.me',
	},
	{
		protect: true,
	}
);

export const A = new aws.route53.Record(
	'A_zemn.me',
	{
		aliases: [
			{
				evaluateTargetHealth: false,
				name: 'drunly91pq6ht.cloudfront.net',
				zoneId: 'Z2FDTNDATAQYW2',
			},
		],
		name: zemn_me.name,
		type: 'A',
		zoneId: zemn_me.zoneId,
	},
	{
		protect: true,
	}
);

export const MX = new aws.route53.Record(
	'MX_zemn.me',
	{
		name: zemn_me.name,
		records: [
			'10     ALT3.ASPMX.L.GOOGLE.COM.',
			'10     ALT4.ASPMX.L.GOOGLE.COM.',
			'5      ALT1.ASPMX.L.GOOGLE.COM.',
			'5      ALT2.ASPMX.L.GOOGLE.COM.',
			'1      ASPMX.L.GOOGLE.COM.',
		],
		ttl: 300,
		type: 'MX',
		zoneId: zemn_me.zoneId,
	},
	{
		protect: true,
	}
);

export const NS = new aws.route53.Record(
	'NS_zemn.me',
	{
		name: zemn_me.name,
		records: [
			'ns-454.awsdns-56.com.',
			'ns-816.awsdns-38.net.',
			'ns-1526.awsdns-62.org.',
			'ns-1701.awsdns-20.co.uk.',
		],
		ttl: 172800,
		type: 'NS',
		zoneId: zemn_me.zoneId,
	},
	{
		protect: true,
	}
);

export const SOA = new aws.route53.Record(
	'SOA_zemn.me',
	{
		name: zemn_me.name,
		records: [
			'ns-1701.awsdns-20.co.uk. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400',
		],
		ttl: 900,
		type: 'SOA',
		zoneId: zemn_me.zoneId,
	},
	{
		protect: true,
	}
);

export const TXT = new aws.route53.Record(
	'TXT_zemn.me',
	{
		name: zemn_me.name,
		records: [
			'google-site-verification=plPeQFN6n0_8HZ8hr3HMXbYHrU_Yh5wPP9OUwH0ErGY',
		],
		ttl: 300,
		type: 'TXT',
		zoneId: zemn_me.zoneId,
	},
	{
		protect: true,
	}
);

export default zemn_me;
