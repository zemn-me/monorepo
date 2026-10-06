import { expect, test } from '@jest/globals';
import {
	prepareBoweryBugleResources,
	type ResourceState,
} from '#root/ts/pulumi/retire_bowery_bugle.js';

const root =
	'urn:pulumi:prod::monorepo-2::ts:pulumi:Component$ts:pulumi:bowerybugle.nyc::monorepo_bowerybugle';
const child = (
	name: string,
	type: string,
	extra: Partial<ResourceState> = {}
): ResourceState => ({
	urn: `${root}_${name}`,
	parent: root,
	type,
	...extra,
});

test.each(['staging', 'prod'])(
	'retirement deletes hosting and data but preserves transferred DNSimple resources in %s',
	stack => {
		const resources: ResourceState[] = [
			{ urn: root, type: 'ts:pulumi:bowerybugle.nyc' },
			child('website', 'ts:pulumi:lib:Website'),
			child('bucket', 'aws:s3/bucketV2:BucketV2', {
				parent: `${root}_website`,
				protect: stack === 'prod',
				retainOnDelete: true,
				inputs: { tags: { environment: stack } },
				outputs: { id: 'existing-bucket' },
			}),
			child('pdfs', 'aws:s3/bucket:Bucket', {
				protect: true,
				retainOnDelete: true,
				inputs: {},
				outputs: {},
			}),
			child('asset', 'aws:s3/bucketObjectv2:BucketObjectv2', {
				retainOnDelete: true,
			}),
			child('secret', 'gcp:secretmanager/secret:Secret', {
				protect: true,
				retainOnDelete: true,
				inputs: { deletionProtection: true },
				outputs: { deletionProtection: true },
			}),
			child(
				'domain',
				'dnsimple:index/registeredDomain:RegisteredDomain',
				{ protect: true }
			),
			child(
				'delegation',
				'dnsimple:index/domainDelegation:DomainDelegation',
				{ protect: true }
			),
			{
				urn: 'unrelated',
				type: 'aws:s3/bucketV2:BucketV2',
				protect: true,
				inputs: { forceDestroy: false },
			},
		];
		const unrelated = structuredClone(resources.at(-1));
		expect(prepareBoweryBugleResources(resources)).toBe(true);
		for (const resource of resources.slice(0, -1)) {
			expect(resource.protect).not.toBe(true);
			expect(resource.retainOnDelete).toBe(
				resource.type.startsWith('dnsimple:')
			);
		}
		for (const resource of resources.filter(
			r =>
				r.type.startsWith('aws:s3/bucket:') ||
				r.type.startsWith('aws:s3/bucketV2:')
		)) {
			if (resource.urn === 'unrelated') continue;
			expect(resource.inputs?.['forceDestroy']).toBe(true);
			expect(resource.outputs?.['forceDestroy']).toBe(true);
		}
		expect(resources.find(r => r.urn === `${root}_secret`)).toMatchObject({
			inputs: { deletionProtection: false },
			outputs: { deletionProtection: false },
		});
		expect(resources.at(-1)).toEqual(unrelated);
		expect(prepareBoweryBugleResources(resources)).toBe(false);
	}
);

test('an absent or differently named component never changes state', () => {
	const resources = [
		child('bucket', 'aws:s3/bucketV2:BucketV2', { protect: true }),
	];
	const original = structuredClone(resources);
	expect(prepareBoweryBugleResources(resources)).toBe(false);
	expect(resources).toEqual(original);
});
