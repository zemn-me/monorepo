import { expect, test } from '@jest/globals';
import { retainLuluAssets } from '#root/ts/pulumi/retire_lulu.js';

test.each(['prod', 'staging'])(
	'Lulu retirement preserves storage and registration in %s without changing other sites',
	stack => {
		const root = `urn:pulumi:${stack}::monorepo-2::ts:pulumi:lulu.computer::monorepo_lulu`;
		const resources = [
			{
				urn: `${root}_bucket`,
				parent: `${root}_website`,
				type: 'aws:s3/bucketV2:BucketV2',
				retainOnDelete: false,
			},
			{ urn: root, type: 'ts:pulumi:lulu.computer' },
			{
				urn: `${root}_website`,
				parent: root,
				type: 'ts:pulumi:lib:Website',
			},
			{
				urn: `${root}_domain`,
				parent: root,
				type: 'aws:route53domains/registeredDomain:RegisteredDomain',
				retainOnDelete: false,
			},
			{
				urn: 'unrelated',
				type: 'aws:s3/bucketV2:BucketV2',
				retainOnDelete: false,
			},
		];
		expect(retainLuluAssets(resources)).toBe(true);
		expect(resources[0]?.retainOnDelete).toBe(true);
		expect(resources[3]?.retainOnDelete).toBe(true);
		expect(resources[4]?.retainOnDelete).toBe(false);
		expect(retainLuluAssets(resources)).toBe(false);
	}
);
