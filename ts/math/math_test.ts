import * as matrix from '#root/ts/math/matrix.js';
import * as vec from '#root/ts/math/vec.js';

function expectMatrixSimilar(actual: matrix.Matrix, expected: matrix.Matrix) {
	expect(actual.length).toBe(expected.length);
	actual.forEach((row, i) => {
		row.forEach((v, k) => {
			expect(v).toBeCloseTo(expected[i]![k]!);
		});
	});
}

describe('matrix', () => {
	test('width', () => {
		expect(
			matrix.width([
				[1, 2],
				[2, 1],
			])
		).toEqual(2);
	});
	test('a checkerboard matrix', () => {
		expect(
			matrix.checkerboard([
				[1, 2],
				[3, 4],
			])
		).toEqual([
			[1, -2],
			[-3, 4],
		]);
	});
	test('.minors', () => {
		expect(
			matrix.minors([
				[3, 0, 2],
				[2, 0, -2],
				[0, 1, 1],
			] as const)
		).toEqual([
			[2, 2, 2],
			[-2, 3, 3],
			[-0, -10, 0], // dumb
		]);
	});
	describe('.identity', () => {
		test.each([
			[[1, 1], matrix.as<1, 1>([[1]] as const)],
			[
				[3, 3],
				matrix.as<3, 3>([
					[1, 0, 0],
					[0, 1, 0],
					[0, 0, 1],
				] as const),
			],

			[
				[2, 3],
				matrix.as<2, 3>([
					[1, 0],
					[0, 1],
					[0, 0],
				] as const),
			],
		] as const)('%#: (%p) => %p', ([i, j], b) => {
			expect(matrix.identity(i, j)).toEqual(b);
		});
	});

	describe('.transpose', () => {
		test.each([
			[
				matrix.as<3, 2>([
					[1, 2, 3],
					[4, 5, 6],
				] as const),

				matrix.as<2, 3>([
					[1, 4],
					[2, 5],
					[3, 6],
				] as const),
			],

			[
				matrix.as<3, 1>([[1, 2, 3]] as const),

				matrix.as<1, 3>([[1], [2], [3]] as const),
			],
		] as const)('%#: (%p) => %p', (a, b) => {
			expect(matrix.transpose(a)).toEqual(b);
		});
	});

	describe('.determinant', () => {
		test.each([
			[matrix.as<1, 1>([[1]] as const), 1],

			[
				matrix.as([
					[2, 0],
					[0, 5],
				] as const),
				10,
			],

			[
				matrix.as<2, 2>([
					[3, 8],
					[4, 6],
				] as const),

				-14,
			],

			[
				matrix.as<3, 3>([
					[6, 1, 1],
					[4, -2, 5],
					[2, 8, 7],
				] as const),

				-306,
			],

			[
				matrix.as([
					[6, -7],
					[-2, 4],
				] as const),
				10,
			],
		] as const)('%#: (%p) => %p', (a, b) => {
			expect(matrix.determinant(a)).toEqual(b);
		});
	});

	describe('.inverse', () => {
		test.each([
			//[matrix.zero, matrix.zero],

			[
				matrix.as([
					[2, 0],
					[0, 5],
				] as const),

				matrix.as([
					[1 / 2, 0],
					[0, 1 / 5],
				] as const),
			],

			/*[
				matrix.as<2, 2>([
					[3, 3.5],
					[3.2, 3.6],
				] as const),

				matrix.as<2, 2>([
					[-9, 8.75],
					[8, -7.5],
				] as const),

				// 1.12, -3.5
				// -3.2, 1.25
			],*/
			[
				matrix.as([
					[3, 0, 2],
					[2, 0, -2],
					[0, 1, 1],
				] as const),

				matrix.as([
					[0.2, 0.2, 0],
					[-0.2, 0.3, 1],
					[0.2, -0.3, 0],
				] as const),
			],

			[
				matrix.as<2, 2>([
					[4, 7],
					[2, 6],
				] as const),

				matrix.as<2, 2>([
					[0.6, -0.7],
					[-0.2, 0.4],
				] as const),
			],
		] as const)('%#: (%p) => %p', (a, b) => {
			expectMatrixSimilar(matrix.inverse(a), b);
		});

		test.each([
			/*[
				matrix.as<2, 2>([
					[3, 3.5],
					[3.2, 3.6],
				] as const),

				matrix.as<2, 2>([
					[-9, 8.75],
					[8, -7.5],
				] as const),

				// 1.12, -3.5
				// -3.2, 1.25
			],*/

			[
				matrix.as<2, 2>([
					[4, 7],
					[2, 6],
				] as const),
			],
			[
				matrix.as([
					[20, 100, 2],
					[0.2, -10, 1],
					[4, 3, 1],
				] as const),
			],
		] as const)('%#: %p * a => identity', a => {
			const [ij = 0] = matrix.size(a);
			expectMatrixSimilar(
				matrix.mul(a, matrix.inverse(a)),
				matrix.identity(ij, ij)
			);
		});
	});

	describe('.transpose', () => {
		test.each([
			[
				matrix.as<3, 2>([
					[1, 2, 3],
					[4, 5, 6],
				] as const),

				matrix.as<2, 3>([
					[1, 4],
					[2, 5],
					[3, 6],
				] as const),
			],

			[
				matrix.as<3, 1>([[1, 2, 3]] as const),

				matrix.as<1, 3>([[1], [2], [3]] as const),
			],
		] as const)('%#: (%p) => %p', (a, b) => {
			expect(matrix.transpose(a)).toEqual(b);
		});
	});

	describe('.col', () => {
		test.each([
			[
				matrix.as<2, 3>([
					[1, 2],
					[1, 4],
					[6, 5],
				] as const),
				0,
				[1, 1, 6],
			],
		])('%#: (%p, %p) => %p', (a, b, o) => {
			expect([...matrix.col(a, b)]).toEqual(o);
		});
	});

	describe('.row', () => {
		test.each([
			[matrix.as([[1]]), 0, [1]],
			[matrix.as([[1]]), 1, []],
			[matrix.as([[1]]), -1, []],
			[matrix.as([[1]]), Infinity, []],
		])('%#: (%p, %p) => %p', (a, b, o) => {
			expect([...matrix.row(a, b)]).toEqual(o);
		});

		test.each([
			[
				matrix.as<2, 3>([
					[1, 2],
					[1, 4],
					[6, 5],
				] as const),
				0,
				[1, 2],
			],
		])('(%p, %p) => %p', (a, b, o) => {
			expect([...matrix.row(a, b)]).toEqual(o);
		});
	});

	describe('.mul', () => {
		test.each([
			[
				matrix.as<2, 1>([[6, 9]] as const),

				matrix.as<2, 2>([
					[0, 1],
					[1, 0],
				] as const),

				matrix.as<2, 1>([[9, 6]] as const),
			],
			[
				matrix.as<2, 2>([
					[1, 0],
					[0, 1],
				] as const),

				matrix.as<2, 2>([
					[2, 4],
					[10, 9],
				] as const),

				matrix.as<2, 2>([
					[2, 4],
					[10, 9],
				] as const),
			],
		])('%#: (%p, %p) => %p', (a, b, o) => {
			expect(matrix.mul(a, b)).toEqual(o);
		});
	});

	describe('.add', () => {
		test.each([
			[
				matrix.as([
					[1, 2],
					[3, 4],
				] as const),

				matrix.as([
					[4, 3],
					[2, 1],
				] as const),

				matrix.as([
					[5, 5],
					[5, 5],
				]),
			],
		])('%#: (%p, %p) => %p', (a, b, o) => {
			expect(matrix.add(a, b)).toEqual(o);
		});
	});
});

describe('vec', () => {
	describe('.dot', () => {
		test.each([[[1, 2, 3], [3, 2, 1], 10]])(
			'.dot(%p, %p) => %p',
			(a, b, o) => {
				expect(vec.dot(a, b)).toEqual(o);
			}
		);
	});

	describe('.reverse', () => {
		test('[1,2,3] => [3,2,1]', () => {
			expect([...vec.reverse([1, 2, 3])]).toEqual([3, 2, 1]);
		});
	});

	describe('.mul', () => {
		test.each([[2, [3, 2, 1], [6, 4, 2]]])(
			'.mul(%p, %p) => %p',
			(a, b, o) => {
				expect(vec.mul(a, b)).toEqual(o);
			}
		);
	});
});
