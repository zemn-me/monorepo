/* eslint-disable @typescript-eslint/unified-signatures */
export * as dict from '#//ts/iter/dict';

/**
 * Flatten nested iterables into a single iterable.
 */
export function* flatten<T>(it: Iterable<Iterable<T>>): Iterable<T> {
	for (const v of it) {
		for (const v2 of v) yield v2;
	}
}

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
	const cursor: T = i;
	yield cursor;
	for (const next of select(cursor)) {
		yield* walk(next, select);
	}
}

export async function* asyncWalk<T>(
	i: Promise<T> | T,
	select: (v: T) => Promise<T[]> | T[]
): AsyncGenerator<T> {
	const cursor: Promise<T> | T = i;
	yield cursor;
	for (const next of await select(await cursor)) {
		yield* asyncWalk(next, select);
	}
}

/**
 * walkPath walks a chain of values using a selector. It returns a sequence
 * of those values, starting with the currently selected one.
 *
 * This might be somewhat hard to understand in abstract, so for a tree:
 *
 * ```
 *  ┌──►hamburger
 *  │
 *  │
 * eggs
 *  │
 *  │
 *  └──►bacon
 * ```
 *
 * The following values will be generated:
 * 1. `[eggs]`
 * 2. `[hamburger, eggs]`
 * 3. `[bacon, eggs]`
 *
 */
export function* walkPath<T>(
	i: T,
	select: (v: T) => T[]
): Generator<[value: T, ...parents: T[]]> {
	// The logic here is not very simple or easy to read 🙇‍♂️
	// the idea is essentially that instead of iterating directly over T,
	// we iterate over a container of T that is an array of a particular item and
	// any of its parents.
	//
	// Each iteration step has the current item, 'v', and its parents. When `select(v)` gives
	// us a list of children of T, we return each child with the parent appended to the list of its
	// parents.
	yield* walk<[value: T, ...parents: T[]]>([i], ([v, ...parents]) =>
		select(v).map(v2 => [v2, v, ...parents])
	);
}

/**
 * asyncWalkPath walks a chain of values using a selector. It returns a sequence
 * of those values, starting with the currently selected one.
 *
 * This might be somewhat hard to understand in abstract, so for a tree:
 *
 * ```
 *  ┌──►hamburger
 *  │
 *  │
 * eggs
 *  │
 *  │
 *  └──►bacon
 * ```
 *
 * The following values will be generated:
 * 1. `[eggs]`
 * 2. `[hamburger, eggs]`
 * 3. `[bacon, eggs]`
 *
 * Note that this is kind of in reverse? That was probably a mistake and I might
 * change it one day.
 *
 */
export async function* asyncWalkPath<T>(
	i: T,
	select: (v: [value: T, ...parents: T[]]) => Promise<T[]> | T[]
): AsyncGenerator<[value: T, ...parents: T[]]> {
	// The logic here is not very simple or easy to read 🙇‍♂️
	// the idea is essentially that instead of iterating directly over T,
	// we iterate over a container of T that is an array of a particular item and
	// any of its parents.
	//
	// Each iteration step has the current item, 'v', and its parents. When `select(v)` gives
	// us a list of children of T, we return each child with the parent appended to the list of its
	// parents.
	yield* asyncWalk<[value: T, ...parents: T[]]>(
		[i],
		async ([v, ...parents]) =>
			(await select([v, ...parents])).map(v2 => [v2, v, ...parents])
	);
}

/**
 * Transform a generator into an asynchronous list.
 */
export async function unroll<T>(v: AsyncIterable<T>): Promise<T[]> {
	const arr: T[] = [];
	for await (const value of v) arr.push(value);

	return arr;
}
