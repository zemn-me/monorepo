import { describe, expect, test } from '@jest/globals';

import * as deprecatedMatrix from '#root/ts/math/deprecated/matrix.js';
import * as matrix from '#root/ts/math/matrix.js';
import type { Multiply } from '#root/ts/math/type_math.js';

describe('matrix', () => {
	test('requires content length to match width * height', () => {
		const wrongLength = [1, 2, 3, 4, 5] as unknown as matrix.Content<2, 3>;
		expect(() => matrix.as(2, 3, wrongLength)).toThrow(/matrix content length/);
	});

	test('accepts exactly typed content', () => {
		const content = [1, 2, 3, 4, 5, 6] as matrix.Content<3, 2>;
		const m = matrix.as(3, 2, content);
		const exactContent: matrix.Content<3, 2> = matrix.content(m);

		expect(exactContent).toEqual([1, 2, 3, 4, 5, 6]);
	});

	test('converts between rows and flat matrix form', () => {
		const m = matrix.fromRows([
			[1, 2, 3],
			[4, 5, 6],
		] as const);

		expect(matrix.size(m)).toEqual([3, 2]);
		expect(matrix.width(m)).toBe(3);
		expect(matrix.height(m)).toBe(2);
		const contentLength: Multiply<3, 2> = matrix.content(m).length;
		expect(contentLength).toBe(6);
		expect(matrix.content(m)).toEqual([1, 2, 3, 4, 5, 6]);
		expect(matrix.at(m, 1, 1)).toBe(5);
		expect(matrix.at(m, 3, 0)).toBeUndefined();
		expect(matrix.toRows(m)).toEqual([
			[1, 2, 3],
			[4, 5, 6],
		]);
	});

	test('maps with the same position contract as the deprecated nested matrix map', () => {
		const nested = deprecatedMatrix.as<3, 2>([
			[1, 2, 3],
			[4, 5, 6],
		] as const);
		const flat = matrix.fromRows(nested);
		const f = (value: number, [i, j]: readonly [number, number]) =>
			value + i * 10 + j * 100;

		const expected = deprecatedMatrix.map(nested, f);

		expect(matrix.toRows(matrix.map(flat, f))).toEqual(expected);
		expect(matrix.toRows(matrix.mapWithArrayMap(flat, f))).toEqual(expected);
	});
});
