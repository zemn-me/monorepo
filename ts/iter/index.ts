import * as functional from '#root/ts/iter/iterable_functional.js';
import { NewType } from '#root/ts/NewType.js';
import { None, type Option, Some } from '#root/ts/option/option.js';


export * as dict from '#root/ts/iter/dict.js';

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

export const map = functional.map;

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

export const range = functional.range;

export function reduce<I, R>(
	i: Iterable<I>,
	f: (previousValue: R, currentValue: I, currentIndex: number) => R,
	initialValue: R
) {
	return functional.fold(
		(
			p: R,
			[c, i]: [I, number],
		) => f(p, c, i)
	)(initialValue)(
		enumerate(i)
	)
}

export { reduce as fold };



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

export function concat<T1, T2>(
	i: Iterable<T1>,
	i2: Iterable<T2>
): Iterable<T1 | T2> {
	return functional.concat(i)(i2)
}

export function* zip2<A, B>(a: Iterable<A>, b: Iterable<B>): Iterable<readonly [Option<A>, Option<B>]> {
	const [ai, bi] = [a, b].map(v => v[Symbol.iterator]()) as [Iterator<A>, Iterator<B>];
	for (; ;) {
		const [av, bv] = [ai.next(), bi.next()];
		const ret = [
			av.done ? Some(av.value) : None,
			bv.done ? Some(bv.value) : None
		] as const;

		yield ret;

		if (ret.every(v => v.is_none())) break
	}
}

export function* enumerate<T>(v: Iterable<T>): Iterable<[T, number]> {
	let i = 0;
	for (const vv of v) {
		yield [vv, i++]
	}
}

type _Iterable<T> = impl<Iterable<T>>

class impl<T> extends NewType<T> {
	map<I, O>(this: _Iterable<I>, f: (i: I) => O): _Iterable<O> {
		return new impl(map(this.value, f))
	}
	filter<T>(this: _Iterable<Option<T>>): _Iterable<T> {
		return new impl(
			functional.filter<T>(
				this.map(v =>
					v.value
				).value
			)
		)
	}
	sort<T>(this: _Iterable<T>, compareFn?: (a: T, b: T) => number): impl<T[]> {
		return new impl([...this.value].sort(compareFn))
	}

	zip<T, T2>(this: _Iterable<T>, other: Iterable<T2>): impl<Iterable<readonly [Option<T>, Option<T2>]>> {
		return new impl(zip2(this.value, other));
	}

	flatten<T>(this: _Iterable<Iterable<T>>): _Iterable<T> {
		return new impl(flatten(this.value))
	}

	enumerate<T>(this: _Iterable<T>): _Iterable<
		[T, number]> {

		return new impl(enumerate(this.value))
		}

	nth<T>(this: _Iterable<T>, n: number): Option<T> {
		for (const [v, i] of this.enumerate().value) {
			if (i == n) {
				return Some(v);
			}
		}

		return None;
	}

	fold<I, R>(
		this: _Iterable<I>,
		f: (previousValue: R, currentValue: I, currentIndex: number) => R,
		initialValue: R
	): R {
		return reduce(this.value, f, initialValue)
	}

	last<T>(this: _Iterable<T>): Option<T> {
		return this.fold(
			(_, c) => Some(c), None as Option<T>
		)
	}

	to_array<T>(this: _Iterable<T>): T[] {
		return Array.from(this.value)
	}

	first<T>(this: _Iterable<T>): Option<T> {
		return this.nth(0)
	}

	concat<T1, T2>(this: _Iterable<T1>, v: Iterable<T2>): _Iterable<T1 | T2> {
		return new impl(
			concat(this.value, v)
		)
	}


}

function _Iterable<T>(v: Iterable<T>): _Iterable<T> {
	return new impl(v)
}


export { _Iterable as Iterable }
