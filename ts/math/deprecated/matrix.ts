import type { Tuple } from '#root/ts/tuple.js';

type Vector<I extends number = number, T = number> = Tuple<T, I>;

const vec = {
	add: <I extends number>(v1: Vector<I>, v2: Vector<I>): Vector<I> =>
		vec.map(v1, (v, i) => v + v2[i]!),
	dot: (v1: Iterable<number>, v2: Iterable<number>): number =>
		vec.sum(
			imap(
				zip(v1, v2, 0 as const),
				([a = 0 as const, b = 0 as const]) => a * b
			)
		),
	map: <I extends number, T, U>(
		v: Vector<I, T>,
		callbackFn: (value: T, index: number, array: Vector<I, T>) => U
	): Vector<I, U> =>
		/* biome-ignore lint/suspicious/noExplicitAny: this type boundary intentionally uses any */
		v.map(callbackFn as any) as any,
	New: <N extends number>(length: number): Vector<N, unknown> =>
		[...Array(length)] as Vector<N, unknown>,
	sum: (v: Iterable<number>): number => [...v].reduce((a, c) => a + c, 0),
};

const imap: <T, U>(
	v: Iterable<T>,
	f: (v: T, i: number) => U
) => Iterable<U> = function* (v, f) {
	let i = 0;
	for (const l of v) {
		yield f(l, i);
		i++;
	}
};

const zip: <T1, T2, T3>(
	v1: Iterable<T1>,
	v2: Iterable<T2>,
	fb: T3
) => Iterable<[T1 | T3, T2 | T3]> = function* (v1, v2, fb) {
	const [a, b] = [v1[Symbol.iterator](), v2[Symbol.iterator]()];
	for (;;) {
		const [ar, br] = [a.next(), b.next()];
		const left = ar.done ? fb : ar.value;
		const right = br.done ? fb : br.value;

		if (ar.done && br.done) break;

		yield [left, right];
	}
};

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 *
 * J is effectively the number of ROWS and I is the number of COLUMNS.
 */
export type Matrix<
	I extends number = number,
	J extends number = number,
	T = number,
> = Vector<J, Vector<I, T>>;

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 */
export type Square<IJ extends number, T = number> = Matrix<IJ, IJ, T>;

/**
 * @deprecated Use `fromRows` from `#root/ts/math/matrix.js` for new code.
 */
export const as: <
	I extends number = number,
	J extends number = number,
	T = number,
>(
	v: readonly (readonly T[] & { length: I })[] & { length: J }
	/* biome-ignore lint/suspicious/noExplicitAny: this type boundary intentionally uses any */
) => Matrix<I, J, T> = v => v as any;

/**
 * @deprecated Use `as(0, 0, [])` from `#root/ts/math/matrix.js` for new code.
 */
/* biome-ignore lint/suspicious/noExplicitAny: this type boundary intentionally uses any */
export const zero = as<0, 0>([] as any);

/**
 * @deprecated Use `fromFunction` from `#root/ts/math/matrix.js` for new code.
 *
 * Return a new matrix of given dimensions
 */
export function New<I extends number, J extends number>(
	i: I,
	j: J
): Matrix<I, J, unknown> {
	return vec.map(vec.New(j), () => vec.New(i));
}

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 */
export const add: <const I extends number, const J extends number>(
	m1: Matrix<I, J>,
	m2: Matrix<I, J>
) => Matrix<I, J> = <I extends number, J extends number>(
	m1: Matrix<I, J>,
	m2: Matrix<I, J>
) => vec.map(m1, (row, i) => vec.add(row, m2[i]!));

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 *
 * Returns a row of a given matrix as an Iterable.
 * Where the row does not exist, the Iterable is of length 0.
 */
export const row: <I extends number, J extends number, T>(
	v: Matrix<I, J, T>,
	r: number
) => Iterable<T> = function* (v, i) {
	const a = v[i];
	if (!a) return;
	for (let i = 0; i < a.length; i++) yield a[i]!;
};

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 */
export const rows: <I extends number, J extends number, T>(
	v: Matrix<I, J, T>,
	r: number
) => Iterable<Vector<I, T>> = v => v;

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 */
export const col: <I extends number, J extends number, T>(
	v: Matrix<I, J, T>,
	i: number
) => Iterable<T> = function* (v, i) {
	const [, jsize] = size(v);
	for (let j = 0; j < jsize; j++) yield v[j]![i]!;
};

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 */
export function mul<
	const I1 extends number,
	const J1 extends number,
	const I2 extends number,
	const J2 extends number,
>(m1: Matrix<I1, J1>, m2: Matrix<I2, J2>): Matrix<I2, J1> {
	const [/*i1*/ , j1] = size(m1);
	const [i2 /*, j2*/] = size(m2);

	return vec.map(vec.New<J1>(j1), (_, i) =>
		vec.map(vec.New<I2>(i2!), (_, j) => vec.dot(row(m1, i), col(m2, j)))
	);
}

/**
 * @deprecated Use `map` from `#root/ts/math/matrix.js` for new code.
 *
 * Iterate over & enumerate a {@link Matrix}.
 * @param I -- the width of the input matrix.
 * @param J -- the height of the input matrix.
 * @param T -- the type of each value in the matrix.
 * @param O -- the output type of each point once mapped.
 * @param m {@link m} -- the matrix to iterate over.
 * @param f {@link f} -- a mapping function taking value, position and m.
 *
 */
export const map: <I extends number, J extends number, T, O>(
	m: Matrix<I, J, T>,
	/**
	 * A mapping function over a matrix.
	 * @param v -- {@link v} the value at a point in the matrix.
	 * @param pos -- {@link pos} the i, j position in the matrix.
	 * @param matrix -- {@link matrix} the input matrix.
	 */
	f: (
		v: T,
		pos: readonly [i: number, j: number],
		matrix: Matrix<I, J, T>
	) => O
) => Matrix<I, J, O> = (m, f) =>
	vec.map(m, (row, j) => vec.map(row, (v, i) => f(v, [i, j], m)));

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 */
export function sub<I extends number, J extends number>(
	m1: Matrix<I, J, number>,
	m2: Matrix<I, J, number>
): Matrix<I, J, number> {
	return add(
		m1,
		map(m2, v => -v)
	);
}

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 *
 * For vector-shaped matricies, gives the equivilent magnitude.
 */
export function magnitude(m: Matrix<1, number>): number {
	return Math.sqrt(vec.sum(map(m, (v: number) => v ** 2).flat()));
}

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 */
export const length = magnitude;

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 *
 * For vector-shaped matricies, gives the equivilent unit vector.
 */
export function unit<J extends number>(m: Matrix<1, J>): Matrix<1, J> {
	const mag = magnitude(m);
	return map<1, J, number, number>(m, (v: number) => v / mag);
}

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 *
 * For vector-shaped matricies, performs the dot operation.
 */
export function dot<J extends number>(m1: Matrix<1, J>, m2: Matrix<1, J>) {
	return vec.dot(m1.flat(), m2.flat());
}

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 */
export const normalise = unit;

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 *
 * For a vector3 analagous matrix, performs the cross operation.
 */
export function cross(
	m1: Matrix<1, 3, number>,
	m2: Matrix<1, 3, number>
): Matrix<1, 3, number> {
	const x1 = m1[0]![0]!;
	const y1 = m1[1]![0]!;
	const z1 = m1[2]![0]!;
	const x2 = m2[0]![0]!;
	const y2 = m2[1]![0]!;
	const z2 = m2[2]![0]!;

	const cx = y1 * z2 - z1 * y2;
	const cy = z1 * x2 - x1 * z2;
	const cz = x1 * y2 - y1 * x2;

	return [[cx], [cy], [cz]];
}

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 *
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

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 */
export function is<T>(
	v: readonly (readonly T[])[]
): v is Matrix<number, number, T> {
	// each row must be of the same size

	return v.every((row, _, a) => row.length == a[0]!.length);
}

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 */
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
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 *
 * `Multiply` gives the type of the matrix made by multiplying 2 given matricies.
 */
export type Multiply<
	A extends Matrix<number, number, unknown>,
	B extends Matrix<number, number, unknown>,
	O = number,
> = [A, B] extends [
	/* biome-ignore lint/suspicious/noExplicitAny: this type boundary intentionally uses any */
	Matrix<any, infer J1, unknown>,
	/* biome-ignore lint/suspicious/noExplicitAny: this type boundary intentionally uses any */
	Matrix<infer I2, any, unknown>,
]
	? Matrix<I2, J1, O>
	: never;

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 *
 * `TransformTo` gives the type of the matrix that can be used to transform an input matrix
 * into an output matrix
 */
export type TransformTo<
	In extends Matrix<number, number, unknown>,
	Out extends Matrix<number, number, unknown>,
	/*O = number*/
> = [In, Out] extends [
	/* biome-ignore lint/suspicious/noExplicitAny: this type boundary intentionally uses any */
	Matrix<any, infer J1, unknown>,
	Matrix<infer I2, infer J2, unknown>,
]
	? J2 extends J1
		? /* biome-ignore lint/suspicious/noExplicitAny: this type boundary intentionally uses any */
			Matrix<I2, any>
	: never // it isn't possible for these to be different
	: never;

/**
 * @deprecated Use `size` from `#root/ts/math/matrix.js` for new code.
 */
export const size: <I extends number, J extends number>(
	/* biome-ignore lint/suspicious/noExplicitAny: this type boundary intentionally uses any */
	m: Matrix<I, J, any>
) => J extends 0 ? [undefined, J] : [I, J] = m =>
	/* biome-ignore lint/suspicious/noExplicitAny: this type boundary intentionally uses any */
	[m[0]?.length, m.length] as any;

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 */
export const transpose: <I extends number, J extends number>(
	m: Matrix<I, J>
) => Matrix<J, I> = <I extends number, J extends number>(m: Matrix<I, J>) => {
	const [i, j] = size(m);
	const rows = vec.New<I>(i!);

	return vec.map(rows, (_, rj) =>
		vec.map(vec.New<J>(j), (__, vi) => m[vi]![rj]!)
	);
};

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 *
 * Returns an identity matrix of given dimensions
 */
export const identity: <I extends number, J extends number>(
	I: I,
	J: J
) => Matrix<I, J, 1 | 0> = <I extends number, J extends number>(i: I, j: J) =>
	map(New<I, J>(i, j), (_, [i, j]) => +!(i - j) as 1 | 0);

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 */
// https://www.mathsisfun.com/algebra/matrix-determinant.html
export const determinant: <IJ extends number>(m: Square<IJ>) => number = m => {
	const [ij] = size(m);

	if (ij == 0) return 0;
	if (ij == 1) return m[0]![0]!;

	if (ij == 2) {
		// actually not sure what the issue is here...
		// biome-ignore lint/suspicious/noExplicitAny: this type boundary intentionally uses any
		const [[a, b], [c, d]] = m as any;
		return a * d - b * c;
	}

	const top = m[0];
	const rest = m.slice(1); // of length J - 1;
	return top!.reduce((acc, cur, ind) => {
		const mul = ind % 2 == 0 ? 1 : -1;
		// remove every value in the same row
		const nm = rest.map(row => row.filter((_, ri) => ri !== ind));
		// this should give us a new matrix we can get the determinant for
		return acc + cur * determinant(nm) * mul;
	}, 0);
};

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 */
//https://www.mathsisfun.com/algebra/matrix-inverse-minors-cofactors-adjugate.html
export const minors: <IJ extends number>(s: Square<IJ>) => Square<IJ> = s =>
	map(s, (_, [column, row], m) => {
		// form a new matrix omitting the row and column of the selected value
		const smaller = filter(
			m,
			(_, [sColumn, sRow]) => column !== sColumn && row !== sRow
		);

		mustIsSquare(smaller);

		return determinant(smaller);
	});

/**
 * @deprecated Use `width` from `#root/ts/math/matrix.js` for new code.
 */
export const width: (m: Matrix) => number = m => m[0]?.length ?? 0;

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 */
export const checkerboard: <I extends number, J extends number>(
	m: Matrix<I, J>
) => Matrix<I, J> = m =>
	map(m, (n, [col, row]) => ((col + row) % 2 == 0 ? n : -n));

/**
 * @deprecated Use the flat Church-encoded matrix API in
 * `#root/ts/math/matrix.js` for new code.
 *
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

/**
 * @deprecated Use `fromRows` from `#root/ts/math/matrix.js` for new code.
 *
 * Convert a vector into matrix form.
 *
 * I'm sure there must be a name for this convention but I don't know it.
 */
export function fromVec<L extends number, T>(v: Vector<L, T>): Matrix<1, L, T> {
	return vec.map(v, v => [v]);
}
