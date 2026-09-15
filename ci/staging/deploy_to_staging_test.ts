import { beforeEach, expect, jest, test } from '@jest/globals';

const result = { summary: { message: 'completed' } };
const stack = {
	refresh: jest.fn(async () => result),
	up: jest.fn(async () => result),
	destroy: jest.fn(async () => result),
	outputs: jest.fn(async () => ({})),
};

jest.unstable_mockModule('#root/ts/pulumi/stack.js', () => ({
	staging: async () => stack,
}));

const { default: deployToStaging } = await import(
	'#root/ts/pulumi/deploy_to_staging.js'
);

beforeEach(() => {
	jest.clearAllMocks();
});

test('staging refreshes before deploying by default', async () => {
	await deployToStaging({ overwrite: false, doNotTearDown: true });

	expect(stack.refresh).toHaveBeenCalledTimes(1);
	expect(stack.up).toHaveBeenCalledTimes(1);
	expect(stack.refresh.mock.invocationCallOrder[0]).toBeLessThan(
		stack.up.mock.invocationCallOrder[0]!
	);
});

test('candidate deployment reuses state without refreshing', async () => {
	await deployToStaging({
		overwrite: false,
		doNotTearDown: true,
		skipRefresh: true,
	});

	expect(stack.refresh).not.toHaveBeenCalled();
	expect(stack.up).toHaveBeenCalledTimes(1);
	expect(stack.outputs).toHaveBeenCalledTimes(1);
	expect(stack.destroy).not.toHaveBeenCalled();
});
