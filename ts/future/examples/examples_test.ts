import { describe, expect, it } from '@jest/globals';

import { message } from './basic.js';
import { findUser, name } from './pipeline.js';
import { future } from '#root/ts/future/future.js';

describe('README examples', () => {
	it('renders a resolved future', () => {
		expect(message).toBe('The answer is 42.');
	});

	it('runs and short-circuits the pipeline', () => {
		expect(future(name, value => value, String, String)).toBe('Deep Thought');
		expect(future(findUser(0), String, String, error => error)).toBe(
			'user not found'
		);
	});
});
