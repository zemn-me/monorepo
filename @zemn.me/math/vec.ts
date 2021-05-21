interface ReadonlyArrayOfLength<T, I extends number> extends ReadonlyArray<T> {
	length: I
}

export interface Vector<I extends number = number, T = number>
	extends ReadonlyArrayOfLength<T, I> {
	length: I
}

type mapFn<I extends number, T> = <U>(
	callbackFn: (value: T, index: number, array: Vector<I, T>) => U,
	thisArg?: any,
) => Vector<I, U>

/**
 * Map a Vector, returning a new Vector.
 */
export const map: <I extends number, T, U>(
	vec: Vector<I, T>,
	callbackFn: (value: T, index: number, array: Vector<I, T>) => U,
) => Vector<I, U> = (vec, c) => (vec.map as mapFn<any, any>)(c)

/**
 * Map an Iterable, returning a new Iterable.
 */
export const imap: <T, U>(
	v: Iterable<T>,
	f: (v: T, i: number) => U,
) => Iterable<U> = function* (v, f) {
	let i = 0
	for (const l of v) {
		yield f(l, i)
		i++
	}
}

/**
 * Returns an iterable on a vector that iterates in reverse
 */
export const reverse: <I extends number, T>(v: Vector<I, T>) => Iterable<T> =
	function* (v) {
		for (let i = 0; i < v.length; i++) {
			yield v[v.length - i - 1]
		}
	}

export const as: <T, L extends number>(
	v: readonly T[] & { length: L },
) => Vector<L, T> = (v) => v as any

export const New: <N extends number>(n: number) => Vector<N, undefined> = (n) =>
	[...Array(n)] as any as Vector<any, undefined>

export const add: <I extends number>(
	v1: Vector<I>,
	v2: Vector<I>,
) => Vector<I> = (v1, v2) => {
	;[v1, v2] = [v1, v2].sort((a, b) => b.length - a.length)
	return map(v1, (v, i) => v + (i in v2 ? v2[i] : 0))
}

export const mul: <I extends number>(v1: number, v2: Vector<I>) => Vector<I> = (
	v1,
	v2,
) => map(v2, (v, i) => v * v1)

export const div: <I extends number>(v1: Vector<I>, v2: number) => Vector<I> = (
	v2,
	v1,
) => map(v2, (v, i) => v / v1)

/*
export const unit = <T extends number>(vector: Vector<T>): Vector<T> => {
	const m = mag(vector)
	return map(vector, (v) => v / m)
}
*/

export const dot: (v1: Iterable<number>, v2: Iterable<number>) => number = (
	v1,
	v2,
) =>
	sum(
		imap(
			zip(v1, v2, 0 as const),
			([a = 0 as const, b = 0 as const]) => a * b,
		),
	)

export const sum: (v1: Iterable<number>) => number = (v) =>
	[...v].reduce((a, c) => a + c, 0)

const _zip: <T1, T2, T3>(
	v1: Iterable<T1>,
	v2: Iterable<T2>,
	fb: T3,
) => Iterable<[T1 | T3, T2 | T3]> = function* (v1, v2, fb) {
	const [a, b] = [v1[Symbol.iterator](), v2[Symbol.iterator]()]
	for (let i = 0; ; i++) {
		const [ar, br] = [a.next(), b.next()]
		const left = ar.done ? fb : ar.value
		const right = br.done ? fb : br.value

		if (ar.done && br.done) break

		yield [left, right]
	}
}
export const zip: {
	<T1, T2, L extends number>(
		v1: ReadonlyArrayOfLength<T1, L>,
		v2: ReadonlyArrayOfLength<T2, L>,
	): Iterable<[T1, T2]>
	<T1, T2, T3>(v1: Iterable<T1>, v2: Iterable<T2>, fb: T3): Iterable<
		[T1 | T3, T2 | T3]
	>
} = _zip as any

export const mag = (v: Vector<number>): number =>
	Math.sqrt(sum(map(v, (v) => Math.pow(v, 2))))