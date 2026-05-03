import { describe, expect, test } from '@jest/globals';

import { pipe } from '#root/ts/pipe.js';

describe('pipe', () => {
	test('returns the original value when no functions are provided', () => {
		expect(pipe(3)).toBe(3);
	});

	test('applies functions from left to right', () => {
		const result = pipe(
			2,
			value => value + 3,
			value => value * 4,
			value => `value:${value}`
		);

		expect(result).toBe('value:20');
	});
});
