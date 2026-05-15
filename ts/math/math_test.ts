import { describe, expect, test } from '@jest/globals';

import {
	Point,
	point,
	rectContaninsPoint,
	scale,
	translate,
} from '#root/ts/math/cartesian.js';
import * as matrix from '#root/ts/math/matrix.js';
import * as vec from '#root/ts/math/vec.js';

function loose(rows: number[][]): matrix.Matrix<number, number> {
	return matrix.fromRows(
		rows as (number[] & { length: number })[] & { length: number }
	);
}

function expectMatrixRowsSimilar(
	actual: matrix.Matrix<number, number>,
	expectedRows: number[][]
) {
	const actualRows = matrix.toRows(actual);
	expect(actualRows.length).toBe(expectedRows.length);
	actualRows.forEach((row, i) => {
		row.forEach((value, k) => {
			expect(value).toBeCloseTo(expectedRows[i]![k]!);
		});
	});
}

describe('matrix', () => {
	test('width', () => {
		expect(
			matrix.width(
				loose([
					[1, 2],
					[2, 1],
				])
			)
		).toEqual(2);
	});

	test('a checkerboard matrix', () => {
		expect(
			matrix.toRows(
				matrix.checkerboard(
					loose([
						[1, 2],
						[3, 4],
					])
				)
			)
		).toEqual([
			[1, -2],
			[-3, 4],
		]);
	});

	test('.minors', () => {
		expect(
			matrix.toRows(
				matrix.minors(
					loose([
						[3, 0, 2],
						[2, 0, -2],
						[0, 1, 1],
					])
				)
			)
		).toEqual([
			[2, 2, 2],
			[-2, 3, 3],
			[-0, -10, 0],
		]);
	});

	test('.identity', () => {
		const cases: [width: number, height: number, expected: number[][]][] = [
			[1, 1, [[1]]],
			[
				3,
				3,
				[
					[1, 0, 0],
					[0, 1, 0],
					[0, 0, 1],
				],
			],
			[
				2,
				3,
				[
					[1, 0],
					[0, 1],
					[0, 0],
				],
			],
		];

		for (const [width, height, expected] of cases) {
			expect(matrix.toRows(matrix.identity(width, height))).toEqual(expected);
		}
	});

	test('.transpose', () => {
		const cases: [input: number[][], expected: number[][]][] = [
			[
				[
					[1, 2, 3],
					[4, 5, 6],
				],
				[
					[1, 4],
					[2, 5],
					[3, 6],
				],
			],
			[[[1, 2, 3]], [[1], [2], [3]]],
		];

		for (const [input, expected] of cases) {
			expect(matrix.toRows(matrix.transpose(loose(input)))).toEqual(expected);
		}
	});

	test('.determinant', () => {
		const cases: [input: number[][], expected: number][] = [
			[[[1]], 1],
			[
				[
					[2, 0],
					[0, 5],
				],
				10,
			],
			[
				[
					[3, 8],
					[4, 6],
				],
				-14,
			],
			[
				[
					[6, 1, 1],
					[4, -2, 5],
					[2, 8, 7],
				],
				-306,
			],
			[
				[
					[6, -7],
					[-2, 4],
				],
				10,
			],
		];

		for (const [input, expected] of cases) {
			expect(matrix.determinant(loose(input))).toEqual(expected);
		}
	});

	test('.inverse', () => {
		const cases: [input: number[][], expected: number[][]][] = [
			[
				[
					[2, 0],
					[0, 5],
				],
				[
					[1 / 2, 0],
					[0, 1 / 5],
				],
			],
			[
				[
					[3, 0, 2],
					[2, 0, -2],
					[0, 1, 1],
				],
				[
					[0.2, 0.2, 0],
					[-0.2, 0.3, 1],
					[0.2, -0.3, 0],
				],
			],
			[
				[
					[4, 7],
					[2, 6],
				],
				[
					[0.6, -0.7],
					[-0.2, 0.4],
				],
			],
		];

		for (const [input, expected] of cases) {
			expectMatrixRowsSimilar(matrix.inverse(loose(input)), expected);
		}
	});

	test('.inverse composes with multiplication to identity', () => {
		const cases: number[][][] = [
			[
				[4, 7],
				[2, 6],
			],
			[
				[20, 100, 2],
				[0.2, -10, 1],
				[4, 3, 1],
			],
		];

		for (const inputRows of cases) {
			const input = loose(inputRows);
			const [ij = 0] = matrix.size(input);
			expectMatrixRowsSimilar(
				matrix.mul(input, matrix.inverse(input)),
				matrix.toRows(matrix.identity(ij, ij))
			);
		}
	});

	test('.col', () => {
		expect([
			...matrix.col(
				loose([
					[1, 2],
					[1, 4],
					[6, 5],
				]),
				0
			),
		]).toEqual([1, 1, 6]);
	});

	test('.row', () => {
		const single = loose([[1]]);
		const cases: [row: number, expected: number[]][] = [
			[0, [1]],
			[1, []],
			[-1, []],
			[Infinity, []],
		];

		for (const [row, expected] of cases) {
			expect([...matrix.row(single, row)]).toEqual(expected);
		}

		expect([
			...matrix.row(
				loose([
					[1, 2],
					[1, 4],
					[6, 5],
				]),
				0
			),
		]).toEqual([1, 2]);
	});

	test('.mul', () => {
		const cases: [
			left: number[][],
			right: number[][],
			expected: number[][],
		][] = [
			[
				[[6, 9]],
				[
					[0, 1],
					[1, 0],
				],
				[[9, 6]],
			],
			[
				[
					[1, 0],
					[0, 1],
				],
				[
					[2, 4],
					[10, 9],
				],
				[
					[2, 4],
					[10, 9],
				],
			],
		];

		for (const [left, right, expected] of cases) {
			expect(matrix.toRows(matrix.mul(loose(left), loose(right)))).toEqual(
				expected
			);
		}
	});

	test('.add', () => {
		expect(
			matrix.toRows(
				matrix.add(
					loose([
						[1, 2],
						[3, 4],
					]),
					loose([
						[4, 3],
						[2, 1],
					])
				)
			)
		).toEqual([
			[5, 5],
			[5, 5],
		]);
	});
});

describe('cartesian', () => {
	test('translate adds points component-wise', () => {
		expect(translate(point<3>(1, 2, 3), point<3>(4, 5, 6))).toEqual(
			point<3>(5, 7, 9)
		);
	});

	test('scale multiplies each component by a scalar', () => {
		expect(scale(point<3>(1, -2, 3), 2.5)).toEqual(point<3>(2.5, -5, 7.5));
	});
});

describe('vec', () => {
	describe('.dot', () => {
		test.each([
			[[1, 2, 3], [3, 2, 1], 10],
		])('.dot(%p, %p) => %p', (a, b, o) => {
			expect(vec.dot(a, b)).toEqual(o);
		});
	});

	describe('.reverse', () => {
		test('[1,2,3] => [3,2,1]', () => {
			expect([...vec.reverse([1, 2, 3])]).toEqual([3, 2, 1]);
		});
	});

	describe('.mul', () => {
		test.each([
			[2, [3, 2, 1], [6, 4, 2]],
		])('.mul(%p, %p) => %p', (a, b, o) => {
			expect(vec.mul(a, b)).toEqual(o);
		});
	});
});

describe('cartesian', () => {
	describe('rectContainsPoint', () => {
		const testCases = [
			[[[0], [0]], [[10], [10]], [[5], [5]], true],
			[[[0], [0]], [[10], [10]], [[-1], [-1]], false],
		] as [min: Point<2>, max: Point<2>, point: Point<2>, result: boolean][];

		test.each(
			testCases
		)('rectContainsPoint(%p)(%p)(%p) -> %p', (min, max, point, result) =>
			expect(rectContaninsPoint<2>(min)(max)(point)).toEqual(result));
	});
});
