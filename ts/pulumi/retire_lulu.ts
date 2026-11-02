import type { Stack } from '@pulumi/pulumi/automation/index.js';

interface ResourceState {
	urn: string;
	parent?: string;
	type: string;
	retainOnDelete?: boolean;
}

/** Retire Lulu's hosting without deleting its registration or retained assets. */
export function retainLuluAssets(resources: ResourceState[]): boolean {
	const retired = new Set(
		resources
			.filter(
				r =>
					r.type === 'ts:pulumi:lulu.computer' &&
					r.urn.endsWith('::monorepo_lulu')
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
		if (
			![
				'aws:s3/bucket:Bucket',
				'aws:s3/bucketV2:BucketV2',
				'aws:route53domains/registeredDomain:RegisteredDomain',
			].includes(resource.type) ||
			resource.retainOnDelete
		)
			continue;
		resource.retainOnDelete = true;
		changed = true;
	}
	return changed;
}

export async function prepareLuluRetirement(stack: Stack): Promise<void> {
	const state = await stack.exportStack();
	if (state.version !== 3 || !Array.isArray(state.deployment?.resources)) {
		throw new Error('Unsupported Pulumi state format for Lulu retirement');
	}
	if (state.deployment.pending_operations?.length) {
		throw new Error(
			'Resolve pending Pulumi operations before retiring Lulu'
		);
	}
	if (retainLuluAssets(state.deployment.resources))
		await stack.importStack(state);
}
