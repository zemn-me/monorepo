import { setImmediate } from 'node:timers/promises';
import { expect, jest, test } from '@jest/globals';

const outputs = jest.fn<() => Promise<Record<string, never>>>();
jest.unstable_mockModule('#root/ts/pulumi/stack.js', () => ({
	staging: async () => ({
		exportStack: async () => ({ version: 3, deployment: { resources: [] } }),
		up: async () => ({ summary: { message: 'Update complete' } }),
		outputs,
	}),
}));

const { main } = await import('./deploy_to_staging.js');
const candidate = { doNotTearDown: true, overwrite: false, skipRefresh: true };

test('finishes the output read before the caller cleans up the Pulumi home', async () => {
	let readComplete = false;
	outputs.mockImplementationOnce(async () => {
		await setImmediate();
		readComplete = true;
		return {};
	});

	await main(candidate);

	expect(readComplete).toBe(true);
});

test('reports an output read failure to the staging caller', async () => {
	outputs.mockRejectedValueOnce(new Error('stack outputs unavailable'));

	await expect(main(candidate)).rejects.toThrow(
		'outputs testing failed: stack outputs unavailable'
	);
});
