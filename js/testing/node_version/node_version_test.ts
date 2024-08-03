import { expect, test } from '@jest/globals';
test('node version must be at least 18', () => {
	const match = /^v(\d+)/.exec(process.version);
	expect(match).not.toBe(null);

	const m = match!;
	expect(+m[1]!).toBeGreaterThanOrEqual(18);
});
