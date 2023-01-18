import { Tuple } from 'monorepo/ts/math/primitive';

/**
 * A mathematical structure with n-dimensional magnitude.
 */
export class Vector<N extends number = number, A extends N[] = N[]> extends Tuple<N, A> {
    constructor(...a: A) {
        super(...a)
    }
	
	static override fromIterable<T extends number>(v: Iterable<T>): Vector<T> {
		return new Vector(...v);
	}
}

/**
 * Map a Vector, returning a new Vector.
 */
export const map = <N extends number, A extends N[], U extends number>(
	vec: Vector<N, A>,
	callbackFn: (value: N, index: number, array: Vector<N, A>) => U
) => new Vector(...vec.map<U>(callbackFn));

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
export const reverse: <I extends T[], T extends number>(v: Vector<I>) => Iterable<T> =
	function* (v) {
		for (let i = 0; i < v.length; i++) {
			yield v[v.length - i - 1];
		}
	};

export const as: <T, L extends number>(
	v: readonly T[] & { length: L }
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
) => Vector<L, T> = v => v as any;

export const New: <N extends number>(n: number) => Vector<N, undefined> = n =>
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
	[...Array(n)] as any as Vector<any, undefined>;

export const add: <I extends number>(
	v1: Vector<I>,
	v2: Vector<I>
) => Vector<I> = (v1, v2) => map(v1, (v, i) => v + v2[i]);

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
	<T extends number, T2 extends number, L extends number>(
		v1: Vector<T> & { length: L},
		v2: Vector<T2> & { length: L}
	): Iterable<[T1, T2]>;
	<T1, T2, T3>(v1: Iterable<T1>, v2: Iterable<T2>, fb: T3): Iterable<
		[T1 | T3, T2 | T3]
	>;
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
} = _zip as any;
