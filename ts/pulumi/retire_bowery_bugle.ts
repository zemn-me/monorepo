import type { Stack } from '@pulumi/pulumi/automation/index.js';

export interface ResourceState {
	urn: string;
	parent?: string;
	type: string;
	protect?: boolean;
	retainOnDelete?: boolean;
	inputs?: Record<string, unknown>;
	outputs?: Record<string, unknown>;
}

/** One-time, owner-authorized teardown; the transferred registration is retained. */
export function prepareBoweryBugleResources(
	resources: ResourceState[]
): boolean {
	const retired = new Set(
		resources
			.filter(
				r =>
					r.type === 'ts:pulumi:bowerybugle.nyc' &&
					r.urn.endsWith('::monorepo_bowerybugle')
			)
			.map(r => r.urn)
	);
	let size: number;
	do {
		size = retired.size;
		for (const resource of resources) {
			if (resource.parent && retired.has(resource.parent))
				retired.add(resource.urn);
		}
	} while (size !== retired.size);

	let changed = false;
	for (const resource of resources) {
		if (!retired.has(resource.urn)) continue;
		const transferred =
			resource.type ===
				'dnsimple:index/registeredDomain:RegisteredDomain' ||
			resource.type ===
				'dnsimple:index/domainDelegation:DomainDelegation';
		if (resource.protect) {
			resource.protect = false;
			changed = true;
		}
		if (resource.retainOnDelete !== transferred) {
			resource.retainOnDelete = transferred;
			changed = true;
		}
		for (const properties of [resource.inputs, resource.outputs]) {
			if (!properties) continue;
			if (
				['aws:s3/bucket:Bucket', 'aws:s3/bucketV2:BucketV2'].includes(
					resource.type
				) &&
				properties['forceDestroy'] !== true
			) {
				properties['forceDestroy'] = true;
				changed = true;
			}
			if (
				resource.type === 'aws:ecr/repository:Repository' &&
				properties['forceDelete'] !== true
			) {
				properties['forceDelete'] = true;
				changed = true;
			}
			if (
				resource.type === 'gcp:secretmanager/secret:Secret' &&
				properties['deletionProtection'] === true
			) {
				properties['deletionProtection'] = false;
				changed = true;
			}
		}
	}
	return changed;
}

export async function prepareBoweryBugleRemoval(stack: Stack): Promise<void> {
	const state = await stack.exportStack();
	if (state.version !== 3 || !Array.isArray(state.deployment?.resources)) {
		throw new Error(
			'Unsupported Pulumi state format for Bowery Bugle retirement'
		);
	}
	if (state.deployment.pending_operations?.length) {
		throw new Error(
			'Resolve pending Pulumi operations before retiring Bowery Bugle'
		);
	}
	if (prepareBoweryBugleResources(state.deployment.resources)) {
		await stack.importStack(state);
	}
}
