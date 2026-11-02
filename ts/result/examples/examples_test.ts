import { describe, expect, it } from '@jest/globals';

import { answer, doubled } from './basic.js';
import { normalize } from './react.js';
import { is_err, unwrap } from '#root/ts/result/result.js';

describe('README examples', () => {
	it('doubles a successful result', () => {
		expect(answer).toBe(42);
	});

	it('normalizes nonzero vectors and rejects zero vectors', () => {
		expect(unwrap(normalize([0, 3, 4]))).toEqual([0, 0.6, 0.8]);
		expect(is_err(normalize([0, 0, 0]))).toBe(true);
	});
});
