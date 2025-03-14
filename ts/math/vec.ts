import { Tuple } from '#root/ts/tuple.js';

export type Vector<I extends number = number, T = number> = Tuple<T, I>;

export function magnitude(v: Vector): number {
	return Math.sqrt(
		sum(
		v.map(v => v ** 2)))
}

export function unit<N extends number>(v: Vector<N>): Vector<N> {
	const mag = magnitude(v);
	return map(v, x => x / mag);
}

export const normalise = unit;

/**
 * Map a Vector, returning a new Vector.
 */
export const map: <I extends number, T, U>(
	vec: Vector<I, T>,
	callbackFn: (value: T, index: number, array: Vector<I, T>) => U
) => Vector<I, U> = (vec, c) =>
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
	vec.map(c as any) as any;

/**
 * Map an Iterable, returning a new Iterable.
 */
export const imap: <T, U>(
	v: Iterable<T>,
	f: (v: T, i: number) => U
) => Iterable<U> = function* (v, f) {
	let i = 0;
	for (const l of v) {
		yield f(l, i);
		i++;
	}
};

/**
 * Returns an iterable on a vector that iterates in reverse
 */
export const reverse: <I extends number, T>(v: Vector<I, T>) => Iterable<T> =
	function* (v) {
		for (let i = 0; i < v.length; i++) {
			yield v[v.length - i - 1]!;
		}
	};

export const as: <T, L extends number>(
	v: readonly T[] & { length: L }
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
) => Vector<L, T> = v => v as any;

export function New<N extends number>(length: number): Vector<N, unknown> {
	return [...Array(length)] as Vector<N, unknown>;
}

export const add: <I extends number>(
	v1: Vector<I>,
	v2: Vector<I>
) => Vector<I> = (v1, v2) => map(v1, (v, i) => v + v2[i]!);

export const mul: <I extends number>(v1: number, v2: Vector<I>) => Vector<I> = (
	v1,
	v2
) => map(v2, (v /*i*/) => v * v1);

export const dot: (v1: Iterable<number>, v2: Iterable<number>) => number = (
	v1,
	v2
) =>
	sum(
		imap(
			zip(v1, v2, 0 as const),
			([a = 0 as const, b = 0 as const]) => a * b
		)
	);

export const sum: (v1: Iterable<number>) => number = v =>
	[...v].reduce((a, c) => a + c, 0);

const _zip: <T1, T2, T3>(
	v1: Iterable<T1>,
	v2: Iterable<T2>,
	fb: T3
) => Iterable<[T1 | T3, T2 | T3]> = function* (v1, v2, fb) {
	const [a, b] = [v1[Symbol.iterator](), v2[Symbol.iterator]()];
	for (let i = 0; ; i++) {
		const [ar, br] = [a.next(), b.next()];
		const left = ar.done ? fb : ar.value;
		const right = br.done ? fb : br.value;

		if (ar.done && br.done) break;

		yield [left, right];
	}
};
export const zip: {
	<T1, T2, L extends number>(
		v1: Vector<L, T1>,
		v2: Vector<L, T2>
	): Iterable<[T1, T2]>;
	<T1, T2>(
		v1: Iterable<T1>,
		v2: Iterable<T2>,
	): Iterable<[T1 | undefined, T2 | undefined]>;
	<T1, T2, T3>(
		v1: Iterable<T1>,
		v2: Iterable<T2>,
		fb: T3
	): Iterable<[T1 | T3, T2 | T3]>;
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
} = _zip as any;
