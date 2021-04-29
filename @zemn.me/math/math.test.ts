import * as matrix from './matrix'
import * as vec from './vec'

describe('matrix', () => {
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
		] as const)('(%p) => %p', (a, b) => {
			expect(matrix.transpose(a)).toEqual(b)
		})
	})

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
		])('(%p, %p) => %p', (a, b, o) => {
			expect([...matrix.col(a, b)]).toEqual(o)
		})
	})

	describe('.row', () => {
		test.each([
			[matrix.as([[1]]), 0, [1]],
			[matrix.as([[1]]), 1, []],
			[matrix.as([[1]]), -1, []],
			[matrix.as([[1]]), Infinity, []],
		])('(%p, %p) => %p', (a, b, o) => {
			expect([...matrix.row(a, b)]).toEqual(o)
		})

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
			expect([...matrix.row(a, b)]).toEqual(o)
		})
	})

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
		])('(%p, %p) => %p', (a, b, o) => {
			expect(matrix.mul(a, b)).toEqual(o)
		})
	})

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
		])('(%p, %p) => %p', (a, b, o) => {
			expect(matrix.add(a, b)).toEqual(o)
		})
	})
})

describe('vec', () => {
	test.each([[[1, 2, 3], [3, 2, 1], 10]])('.dot(%p, %p) => %p', (a, b, o) => {
		expect(vec.dot(a, b)).toEqual(o)
	})

	test.each([[2, [3, 2, 1], [6, 4, 2]]])('.mul(%p, %p) => %p', (a, b, o) => {
		expect(vec.mul(a, b)).toEqual(o)
	})
})
