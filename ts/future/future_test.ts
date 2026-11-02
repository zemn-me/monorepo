import { describe, expect, it } from '@jest/globals';

import {
	error,
	future,
	future_and_then,
	loading,
	resolve,
} from '#root/ts/future/future.js';

describe('Future', () => {
	it('selects the successful continuation', () => {
		expect(
			future(
				resolve(42),
				value => `resolved: ${value}`,
				() => 'loading',
				() => 'error'
			)
		).toBe('resolved: 42');
	});

	it('selects the loading continuation', () => {
		expect(
			future(
				loading('todos'),
				() => 'resolved',
				value => `loading: ${value}`,
				() => 'error'
			)
		).toBe('loading: todos');
	});

	it('selects the error continuation', () => {
		expect(
			future(
				error('offline'),
				() => 'resolved',
				() => 'loading',
				value => `error: ${value}`
			)
		).toBe('error: offline');
	});

	it('maps a successful value', () => {
		const mapped = future_and_then(resolve(21), value => value * 2);
		expect(mapped(value => value, () => 0, () => 0)).toBe(42);
	});
});
