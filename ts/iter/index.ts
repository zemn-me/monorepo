export * as dict from './dict';

/**
 * For an iterable set of tuples of something, number
 * returns an iterable over something repeated by number
 * @example
 * duplicate([["cool", 1], ["ok", 3]]) -> ["cool", "ok", "ok", "ok"]
 */
export function* duplicate<T>(i: Iterable<[T, number]>) {
	for (const [v, n] of i) {
		for (let i = 0; i < n; i++) {
			yield { ...v }; // copy
		}
	}
}

/**
 * For a given iterable and a selector function, return a new iterable with
 * all values that pass a given function
 */
export function filter<T, O extends T>(
	l: Iterable<T>,
	s: (v: T) => v is O
): Generator<O>;
export function filter<T, O extends T>(
	l: Iterable<T>,
	s: (v: T) => v is O,
	limit: undefined
): Generator<O>;
export function filter<T>(
	l: Iterable<T>,
	s: (v: T) => boolean,
	limit?: number
): Generator<T>;
export function filter<T, O extends T>(
	l: Iterable<T>,
	s: (v: T) => v is O,
	limit?: number
): Generator<O | T>;

export function* filter<T>(
	l: Iterable<T>,
	s: (v: T) => boolean,
	limit = Infinity
): Generator<T> {
	for (const val of l) {
		if (limit > 0 && s(val)) yield val;
		limit--;
	}
}

export function* filterAssert<I, O extends I>(
	i: Iterable<I>,
	s: (v: I) => asserts v is O
): Generator<O> {
	for (const v of i) {
		s(v);

		yield v;
	}
}

/**
 * Returns an iterator over values for which the predicate is false.
 */
export function remove<T, O extends T>(
	l: Iterable<T | O>,
	s: (v: T | O) => v is O
): Generator<T>;
export function remove<T, O extends T>(
	l: Iterable<T | O>,
	s: (v: T | O) => v is O,
	limit: undefined
): Generator<T>;
export function remove<T>(
	l: Iterable<T>,
	s: (v: T) => boolean,
	limit?: number
): Generator<T>;
export function remove<T, O extends T>(
	l: Iterable<T | O>,
	s: (v: T | O) => v is O,
	limit?: number
): Generator<T | O>;

export function* remove<T>(
	l: Iterable<T>,
	s: (v: T) => boolean,
	limit = Infinity
): Generator<T> {
	yield* filter(l, v => !s(v), limit);
}

/**
 * Returns true if any value in a given iterable resolves to true in the given mapping function.
 */
export function some<T>(i: Iterable<T>, f: (i: T) => boolean) {
	for (const it of i) {
		if (f(it)) return true;
	}

	return false;
}

export function* map<I, O>(i: Iterable<I>, f: (i: I) => O): Iterable<O> {
	for (const it of i) yield f(it);
}

/**
 * Separates an iterator into two iterators in one single loop
 */

export function divide<I, O extends I>(
	i: Iterable<I | O>,
	f: (v: I) => v is O
): readonly [Iterable<I>, Iterable<O>];
export function divide<I, O extends I>(
	i: Iterable<I | O>,
	f: (v: I) => boolean
): readonly [Iterable<I>, Iterable<O>];

export function divide<I>(
	i: Iterable<I>,
	f: (v: I) => boolean
): readonly [Iterable<I>, Iterable<I>] {
	return _divide(i, f as (v: I) => v is I);
}

export function _divide<I, O extends I>(
	i: Iterable<I | O>,
	f: (v: I) => v is O
): readonly [Iterable<O>, Iterable<I>] {
	const it = i[Symbol.iterator]();
	const lstack: O[] = [],
		rstack: I[] = [];

	return [
		(function* () {
			for (;;) {
				if (lstack.length) {
					yield lstack.shift()!;
					continue;
				}

				const val = it.next();

				if (val.done) break;

				if (f(val.value)) {
					yield val.value;
					continue;
				}

				rstack.push(val.value);
			}
		})(),
		(function* () {
			for (;;) {
				if (rstack.length) {
					yield rstack.shift()!;
					continue;
				}

				const val = it.next();

				if (val.done) break;

				if (!f(val.value)) {
					yield val.value;
					continue;
				}

				lstack.push(val.value);
			}
		})(),
	];
}

export function* range(start = 0, end = Infinity, step = 1) {
	for (let i = start; i < end; i += step) {
		yield i;
	}
}

export function reduce<I, R>(
	i: Iterable<I>,
	f: (previousValue: R, currentValue: I, currentIndex: number) => R,
	initialValue: R
) {
	let previousValue = initialValue,
		currentIndex = 0;

	for (const currentValue of i) {
		previousValue = f(previousValue, currentValue, currentIndex);
		currentIndex++;
	}

	return previousValue;
}

/**
 * Walks a chain of values using a selector.
 */
export function* walk<T>(i: T, select: (v: T) => T[]): Generator<T> {
	const cursor: T | undefined = i;
	yield cursor;
	for (const next of select(cursor)) {
		yield* walk(next, select);
	}
}

/**
 * Transform a generator into an asynchronous list.
 */
export async function unroll<T>(v: AsyncIterable<T>): Promise<T[]> {
	const arr: T[] = [];
	for await (const value of v) arr.push(value);

	return arr;
}
