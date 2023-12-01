import { Vector } from '#monorepo/ts/math/vec.js';
import * as vec from '#monorepo/ts/math/vec.js';

// J is effectively the number of ROWS and I is the number of COLUMNS
export type Matrix<
	I extends number = number,
	J extends number = number,
	T = number,
> = Vector<J, Vector<I, T>>;

export type Square<IJ extends number, T = number> = Matrix<IJ, IJ, T>;

export const as: <
	I extends number = number,
	J extends number = number,
	T = number,
>(
	v: readonly (readonly T[] & { length: I })[] & { length: J }
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
) => Matrix<I, J, T> = v => v as any;

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export const zero = as<0, 0>([] as any);

/**
 * Return a new matrix of given dimensions
 */
export function New<I extends number, J extends number>(
	i: I,
	j: J
): Matrix<I, J, undefined> {
	return vec.map(vec.New(j), () => vec.New(i));
}

export const add: <I extends number, J extends number>(
	m1: Matrix<I, J>,
	m2: Matrix<I, J>
) => Matrix<I, J> = <I extends number, J extends number>(
	m1: Matrix<I, J>,
	m2: Matrix<I, J>
) => vec.map(m1, (row, i) => vec.add(row, m2[i]));

/**
 * Returns a row of a given matrix as an Iterable.
 * Where the row does not exist, the Iterable is of length 0.
 */
export const row: <I extends number, J extends number, T>(
	v: Matrix<I, J, T>,
	r: number
) => Iterable<T> = function* (v, i) {
	const a = v[i];
	if (!a) return;
	for (let i = 0; i < a.length; i++) yield a[i];
};

export const rows: <I extends number, J extends number, T>(
	v: Matrix<I, J, T>,
	r: number
) => Iterable<Vector<I, T>> = v => v;

export const col: <I extends number, J extends number, T>(
	v: Matrix<I, J, T>,
	i: number
) => Iterable<T> = function* (v, i) {
	const [, jsize] = size(v);
	for (let j = 0; j < jsize; j++) yield v[j][i];
};

export const mul: <
	I1 extends number,
	J1 extends number,
	I2 extends number,
	J2 extends number,
>(
	m1: Matrix<I1, J1>,
	m2: Matrix<I2, J2>
) => Multiply<Matrix<I1, J1>, Matrix<I2, J2>> = <
	I1 extends number,
	J1 extends number,
	I2 extends number,
	J2 extends number,
>(
	m1: Matrix<I1, J1>,
	m2: Matrix<I2, J2>
) => {
	const [, /*i1*/ j1] = size(m1);
	const [i2 /*, j2*/] = size(m2);

	return vec.map(vec.New<J1>(j1), (_, i) =>
		vec.map(vec.New<I2>(i2), (_, j) => vec.dot(row(m1, i), col(m2, j)))
	);
};

export const map: <I extends number, J extends number, T, O>(
	m: Matrix<I, J, T>,
	f: (
		v: T,
		pos: readonly [i: number, j: number],
		matrix: Matrix<I, J, T>
	) => O
) => Matrix<I, J, O> = (m, f) =>
	vec.map(m, (row, j) => vec.map(row, (v, i) => f(v, [i, j], m)));

/**
 * Unsafely drops values in the matrix that do not make f return true.
 *
 * Unsafe in the sense that it may not return a valid matrix (since rows / cols might be incorrect)
 */
export const filter: <T>(
	m: Matrix<number, number, T>,
	f: (
		v: T,
		pos: readonly [i: number, j: number],
		matrix: Matrix<number, number, T>
	) => boolean
) => readonly (readonly T[])[] = (m, f) =>
	m
		.map((row, rowIndex) =>
			row.filter((v, colIndex) => f(v, [colIndex, rowIndex], m))
		)
		.filter(row => row.length !== 0);

export function is<T>(
	v: readonly (readonly T[])[]
): v is Matrix<number, number, T> {
	// each row must be of the same size

	return v.every((row, _, a) => row.length == a[0].length);
}

export function must<T>(
	v: readonly (readonly T[])[]
): asserts v is Matrix<number, number, T> {
	if (!is(v)) throw new Error(`${JSON.stringify(v)} is not a valid matrix`);

	return;
}

function isSquare<T>(m: readonly (readonly T[])[]): m is Square<number, T> {
	return m.every(row => row.length == m.length);
}

function mustIsSquare<T>(
	v: readonly (readonly T[])[]
): asserts v is Square<number, T> {
	if (!isSquare(v))
		throw new Error(`${JSON.stringify(v)} is not a valid square matrix`);
}

/**
 * `Multiply` gives the type of the matrix made by multiplying 2 given matricies.
 */
export type Multiply<
	A extends Matrix<number, number, unknown>,
	B extends Matrix<number, number, unknown>,
	O = number,
> = [A, B] extends [
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
	Matrix<any, infer J1, unknown>,
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
	Matrix<infer I2, any, unknown>,
]
	? Matrix<I2, J1, O>
	: never;

/**
 * `TransformTo` gives the type of the matrix that can be used to transform an input matrix
 * into an output matrix
 */
export type TransformTo<
	In extends Matrix<number, number, unknown>,
	Out extends Matrix<number, number, unknown>,
	/*O = number*/
> = [In, Out] extends [
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
	Matrix<any, infer J1, unknown>,
	Matrix<infer I2, infer J2, unknown>,
]
	? J2 extends J1
		? /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
		  Matrix<I2, any>
		: never // it isn't possible for these to be different
	: never;

export const size: <I extends number, J extends number>(
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
	m: Matrix<I, J, any>
) => J extends 0 ? [undefined, J] : [I, J] = m =>
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
	[m[0]?.length, m.length] as any;

export const transpose: <I extends number, J extends number>(
	m: Matrix<I, J>
) => Matrix<J, I> = <I extends number, J extends number>(m: Matrix<I, J>) => {
	const [i, j] = size(m);
	const rows = vec.New<I>(i);

	return vec.map(rows, (_, rj) =>
		vec.map(vec.New<J>(j), (__, vi) => m[vi][rj])
	);
};

/**
 * Returns an identity matrix of given dimensions
 */
export const identity: <I extends number, J extends number>(
	I: I,
	J: J
) => Matrix<I, J, 1 | 0> = <I extends number, J extends number>(i: I, j: J) =>
	map(New<I, J>(i, j), (_, [i, j]) => +!(i - j) as 1 | 0);

// https://www.mathsisfun.com/algebra/matrix-determinant.html
export const determinant: <IJ extends number>(m: Square<IJ>) => number = m => {
	const [ij] = size(m);

	if ((ij ?? 0) == 0) return 0;
	if (ij == 1) return m[0][0];

	if (ij == 2) {
		const [[a, b], [c, d]] = m;
		return a * d - b * c;
	}

	const top = m[0];
	const rest = m.slice(1); // of length J - 1;
	return top.reduce((acc, cur, ind) => {
		const mul = ind % 2 == 0 ? 1 : -1;
		// remove every value in the same row
		const nm = rest.map(row => row.filter((_, ri) => ri !== ind));
		console.assert(nm[0].length == ij - 1);
		// this should give us a new matrix we can get the determinant for
		return acc + cur * determinant(nm) * mul;
	}, 0);
};

//https://www.mathsisfun.com/algebra/matrix-inverse-minors-cofactors-adjugate.html
export const minors: <IJ extends number>(s: Square<IJ>) => Square<IJ> = s =>
	map(s, (v, [column, row], m) => {
		// form a new matrix omitting the row and column of the selected value
		const smaller = filter(
			m,
			(_, [sColumn, sRow]) => column !== sColumn && row !== sRow
		);

		mustIsSquare(smaller);

		return determinant(smaller);
	});

export const width: (m: Matrix) => number = m => m?.[0]?.length ?? 0;

export const checkerboard: <I extends number, J extends number>(
	m: Matrix<I, J>
) => Matrix<I, J> = m =>
	map(m, (n, [col, row]) => ((col + row) % 2 == 0 ? n : -n));

/**
 * Returns the inverse of a matrix of given dimensions
 */
export const inverse: <IJ extends number>(m: Square<IJ>) => Square<IJ> = <
	IJ extends number,
>(
	m: Square<IJ>
) => {
	const d = 1 / determinant(m);

	return map(transpose(checkerboard(minors(m))), n => d * n);
};
