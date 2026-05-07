import { describe, expect, test } from '@jest/globals';

import {
	decodeBands,
	encodeResistor,
	formatResistance,
	parseResistance,
} from '#root/project/ms/no/r/app/resistor.js';

function expectOk<T extends { readonly ok: boolean }>(
	result: T
): Extract<T, { readonly ok: true }> {
	expect(result.ok).toBe(true);
	return result as Extract<T, { readonly ok: true }>;
}

describe('resistor calculator', () => {
	test('encodes a standard four band resistor', () => {
		const encoded = expectOk(encodeResistor(100_000, 5));

		expect(encoded.value.bands).toEqual([
			'brown',
			'black',
			'yellow',
			'gold',
		]);
		expect(encoded.value.resistanceText).toBe('100k');
	});

	test('encodes a five band value when needed', () => {
		const encoded = expectOk(encodeResistor(111_000, 5));

		expect(encoded.value.bands).toEqual([
			'brown',
			'brown',
			'brown',
			'orange',
			'gold',
		]);
	});

	test('encodes fractional multipliers', () => {
		const encoded = expectOk(encodeResistor(4.7, 5));

		expect(encoded.value.bands).toEqual([
			'yellow',
			'violet',
			'gold',
			'gold',
		]);
	});

	test('decodes colour bands back to resistance and tolerance', () => {
		const decoded = expectOk(
			decodeBands(['brown', 'black', 'yellow', 'gold'])
		);

		expect(decoded.value.resistance).toBe(100_000);
		expect(decoded.value.tolerance).toBe(5);
		expect(decoded.value.resistanceText).toBe('100k');
	});

	test('accepts legacy colour and SI unit aliases', () => {
		const decoded = expectOk(
			decodeBands(['grey', 'red', 'black', 'absent'])
		);

		expect(decoded.value.resistance).toBe(82);
		expect(decoded.value.tolerance).toBe(20);
		expect(parseResistance('10 giga Ohms')).toBe(10_000_000_000);
		expect(parseResistance('470mΩ')).toBeCloseTo(0.47);
	});

	test('formats resistance with familiar SI prefixes', () => {
		expect(formatResistance(0.47)).toBe('470m');
		expect(formatResistance(4_700_000)).toBe('4.7M');
	});
});
