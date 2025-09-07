import { describe, expect, it, jest } from '@jest/globals';

import {
	and,
	and_then,
	flatten,
	from,
	is_none,
	is_some,
	None,
	Some,
	unwrap,
	unwrap_or,
	unwrap_or_else,
	zip
} from '#root/ts/option/types.js';

const _: None = None;
const some1 = Some(1 as const);
const __: Some<1> = some1;

describe('Option Utilities', () => {
	describe('None', () => {
		it('represents None correctly', () => {
			expect(is_none(None)).toBe(true);
			expect(is_some(None)).toBe(false);
		});
	});

	describe('Some', () => {
		it('creates a valid Some', () => {
			const val = 123;
			const someVal = Some(val);

			expect(is_some(someVal)).toBe(true);
			expect(is_none(someVal)).toBe(false);
		});
	});

	describe('is_some', () => {
		it('returns true for Some', () => {
			const val = Some('Hello');
			expect(is_some(val)).toBe(true);
		});

		it('returns false for None', () => {
			expect(is_some(None)).toBe(false);
		});

		it('does not get confused by undefined', () => {
			expect(is_some(Some(undefined))).toBe(true)
		})
	});

	describe('is_none', () => {
		it('returns true for None', () => {
			expect(is_none(None)).toBe(true);
		});

		it('returns false for Some', () => {
			const val = Some('World');
			expect(is_none(val)).toBe(false);
		});
	});

	describe('unwrap', () => {
		it('returns the inner value for Some', () => {
			const val = Some('Unwrap me');
			expect(unwrap(val)).toBe('Unwrap me');
		});

		it('throws if called on None', () => {
			expect(() => unwrap(None)).toThrow('Cannot unwrap Option; has no value.');
		});
	});

	describe('unwrap_or', () => {
		it('returns the inner value if Some', () => {
			const val = Some(42);
			expect(unwrap_or(val, 999)).toBe(42);
		});

		it('returns the fallback if None', () => {
			expect(unwrap_or(None, 'Fallback')).toBe('Fallback');
		});
	});

	describe('unwrap_or_else', () => {
		it('returns the inner value if Some, and does not call the fallback', () => {
			const val = Some('Inner');
			const fallbackFn = jest.fn(() => 'Should not be called');
			expect(unwrap_or_else(val, fallbackFn)).toBe('Inner');
			expect(fallbackFn).not.toHaveBeenCalled();
		});

		it('calls the fallback function and returns its result if None', () => {
			const fallbackFn = jest.fn(() => 'Fallback from function');
			expect(unwrap_or_else(None, fallbackFn)).toBe('Fallback from function');
			expect(fallbackFn).toHaveBeenCalledTimes(1);
		});
	});

	describe('and_then', () => {
		it('applies the function and returns a new Some if original is Some', () => {
			const val = Some(2);
			const result = and_then(val, v => v * 3);
			expect(is_some(result)).toBe(true);
			expect(unwrap(result)).toBe(6);
		});

		it('returns None if original is None', () => {
			const result = and_then(None, (v: number) => v * 3);
			expect(is_none(result)).toBe(true);
		});
	});

	describe('flatten', () => {
		it('unwraps nested Some(Some(T)) to Some(T)', () => {
			const nested = Some(Some('Nested'));
			const flattened = flatten(nested);
			expect(is_some(flattened)).toBe(true);
			expect(unwrap(flattened)).toBe('Nested');
		});

		it('returns None if outer is None', () => {
			expect(is_none(flatten(None))).toBe(true);
		});

		it('returns None if outer is Some(None)', () => {
			const nested = Some(None);
			const flattened = flatten(nested);
			expect(is_none(flattened)).toBe(true);
		});
	});

	describe('zip', () => {
		it('returns Some(tuple) if both Options are Some', () => {
			const optionA = Some('A');
			const optionB = Some('B');
			const zipped = zip(optionA, optionB);

			expect(is_some(zipped)).toBe(true);

			const [valA, valB] = unwrap(zipped);
			expect(valA).toBe('A');
			expect(valB).toBe('B');
		});

		it('returns None if either Option is None', () => {
			const optionA = Some('Present');
			const optionB = None;
			const zipped = zip(optionA, optionB);

			expect(is_none(zipped)).toBe(true);
		});
	});

	describe('and', () => {
		it('returns Some of the new value if first Option is Some', () => {
			const original = Some(10);
			const replacement = 'New Value';
			const result = and(original, replacement);

			expect(is_some(result)).toBe(true);
			expect(unwrap(result)).toBe('New Value');
		});

		it('returns None if the first Option is None', () => {
			const original = None;
			const result = and(original, 123);
			expect(is_none(result)).toBe(true);
		});
	});


	describe('from', () => {
		it('returns Some(T) if value is defined', () => {
			const someVal = from('defined');
			expect(is_some(someVal)).toBe(true);
			expect(unwrap(someVal)).toBe('defined');
		});

		it('returns None if value is undefined', () => {
			const noneVal = from(undefined);
			expect(is_none(noneVal)).toBe(true);
		});
	});
});
