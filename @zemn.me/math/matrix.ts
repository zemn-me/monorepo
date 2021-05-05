import { Vector } from './vec'
import * as vec from './vec'
import { I } from 'ts-toolbelt'

export interface Matrix<
	I extends number = number,
	J extends number = number,
	T = number
> extends Vector<J, Vector<I, T>> {}

export type Square<IJ extends number, T = number> = Matrix<IJ, IJ, T>

export const as: <
	I extends number = number,
	J extends number = number,
	T = number
>(
	v: readonly (readonly T[] & { length: I })[] & { length: J },
) => Matrix<I, J, T> = (v) => v as any

export const zero = as<0, 0>([] as any)

/**
 * Return a new matrix of given dimensions
 */
export function New<I extends number, J extends number>(
	i: I,
	j: J,
): Matrix<I, J, undefined> {
	return vec.map(vec.New(j), () => vec.New(i))
}

export const add: <I extends number, J extends number>(
	m1: Matrix<I, J>,
	m2: Matrix<I, J>,
) => Matrix<I, J> = <I extends number, J extends number>(
	m1: Matrix<I, J>,
	m2: Matrix<I, J>,
) => vec.map(m1, (row, i) => vec.add(row, m2[i]))

/**
 * Returns a row of a given matrix as an Iterable.
 * Where the row does not exist, the Iterable is of length 0.
 */
export const row: <I extends number, J extends number, T>(
	v: Matrix<I, J, T>,
	r: number,
) => Iterable<T> = function* (v, i) {
	const a = v[i]
	if (!a) return
	for (let i = 0; i < a.length; i++) yield a[i]
}

export const rows: <I extends number, J extends number, T>(
	v: Matrix<I, J, T>,
	r: number,
) => Iterable<Vector<I, T>> = (v) => v

export const col: <I extends number, J extends number, T>(
	v: Matrix<I, J, T>,
	i: number,
) => Iterable<T> = function* (v, i) {
	const [, jsize] = size(v)
	for (let j = 0; j < jsize; j++) yield v[j][i]
}

export const mul: <
	I1 extends number,
	J1 extends number,
	I2 extends number,
	J2 extends number
>(
	m1: Matrix<I1, J1>,
	m2: Matrix<I2, J2>,
) => Multiply<Matrix<I1, J1>, Matrix<I2, J2>> = <
	I1 extends number,
	J1 extends number,
	I2 extends number,
	J2 extends number
>(
	m1: Matrix<I1, J1>,
	m2: Matrix<I2, J2>,
) => {
	const [i1, j1] = size(m1)
	const [i2, j2] = size(m2)

	return vec.map(vec.New<J1>(j1), (_, i) =>
		vec.map(vec.New<I2>(i2), (_, j) => vec.dot(row(m1, i), col(m2, j))),
	)
}

export const map: <I extends number, J extends number, T, O>(
	m: Matrix<I, J, T>,
	f: (v: T, pos: [i: number, j: number], matrix: Matrix<I, J, T>) => O,
) => Matrix<I, J, O> = (m, f) =>
	vec.map(m, (row, j) => vec.map(row, (v, i) => f(v, [i, j], m)))

/**
 * `Multiply` gives the type of the matrix made by multiplying 2 given matricies.
 */
export type Multiply<
	A extends Matrix<number, number, unknown>,
	B extends Matrix<number, number, unknown>,
	O = number
> = [A, B] extends [
	Matrix<infer I1, infer J1, unknown>,
	Matrix<infer I2, infer J2, unknown>,
]
	? Matrix<I2, J1, O>
	: never

/**
 * `TransformTo` gives the type of the matrix that can be used to transform an input matrix
 * into an output matrix
 */
export type TransformTo<
	In extends Matrix<number, number, unknown>,
	Out extends Matrix<number, number, unknown>,
	O = number
> = [In, Out] extends [
	Matrix<infer I1, infer J1, unknown>,
	Matrix<infer I2, infer J2, unknown>,
]
	? J2 extends J1
		? Matrix<I2, any>
		: never // it isn't possible for these to be different
	: never

export const size: <I extends number, J extends number>(
	m: Matrix<I, J, any>,
) => J extends 0 ? [undefined, J] : [I, J] = (m) =>
	[m[0]?.length, m.length] as any

export const transpose: <I extends number, J extends number>(
	m: Matrix<I, J>,
) => Matrix<J, I> = <I extends number, J extends number>(m: Matrix<I, J>) => {
	const [i, j] = size(m)
	const rows = vec.New<I>(i)

	return vec.map(rows, (_, rj) =>
		vec.map(vec.New<J>(j), (__, vi) => m[vi][rj]),
	)
}

/**
 * Returns an identity matrix of given dimensions
 */
export const identity: <I extends number, J extends number>(
	I: I,
	J: J,
) => Matrix<I, J, 1 | 0> = <I extends number, J extends number>(i: I, j: J) => {
	return map(New<I, J>(i, j), (_, [i, j]) => +!(i - j) as 1 | 0)
}

// https://www.mathsisfun.com/algebra/matrix-determinant.html
export const determinant: <IJ extends number>(m: Square<IJ>) => number = (
	m,
) => {
	const [ij] = size(m)

	if ((ij ?? 0) == 0) return 0

	if (ij == 2) {
		const [[a, b], [c, d]] = m
		return a * d - b * c
	}

	const top = m[0]
	const rest = m.slice(1) // of length J - 1;
	return top.reduce((acc, cur, ind) => {
		const mul = ind % 2 == 0 ? 1 : -1
		// remove every value in the same row
		const nm = rest.map((row) => row.filter((_, ri) => ri !== ind))
		console.assert(nm[0].length == ij - 1)
		// this should give us a new matrix we can get the determinant for
		return acc + cur * determinant(nm) * mul
	}, 0)
}

/**
 * Returns the inverse of a matrix of given dimensions
 */
export const inverse: <IJ extends number>(m: Square<IJ>) => Square<IJ> = <
	IJ extends number
>(
	m: Square<IJ>,
) => {
	// this is just an intuition, i dont know maths
	const [max] = size(m)


	const partial =  map(m, (v, [i, j], m) => {
		if (i !== j) return -v

		// where i = j, we take the reverse of the sequence
		// from TR to BL
		const n = max - i - 1
		return  m[n][n]!
	});
	
	const des = determinant(partial);
	return map(partial, v => v / des);
}
