import * as matrix from './matrix'
import * as vec from './vec'

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
] as const)('matrix.transpose(%p) => %p', (a, b) => {
	expect(matrix.transpose(a)).toEqual(b)
})

test.each([[[1, 2, 3], [3, 2, 1], 10]])('vec.dot(%p, %p) => %p', (a, b, o) => {
	expect(vec.dot(a, b)).toEqual(o)
})

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
])('matrix.col(%p, %p) => %p', (a, b, o) => {
	expect([...matrix.col(a, b)]).toEqual(o)
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
])('matrix.row(%p, %p) => %p', (a, b, o) => {
	expect([...matrix.row(a, b)]).toEqual(o)
})

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
])('matrix.mul(%p, %p) => %p', (a, b, o) => {
	expect(matrix.mul(a, b)).toEqual(o)
})
