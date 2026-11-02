import { describe, expect, it } from '@jest/globals';

import { add, answer } from './basic.js';

describe('README examples', () => {
	it('runs an async function synchronously', () => {
		expect(answer).toBe(42);
		expect(add(1, 2)).toBe(3);
	});
});
