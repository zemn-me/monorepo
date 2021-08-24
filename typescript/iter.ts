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
	limit: number = Infinity
): Generator<T> {
	for (const val of l) {
		if (limit > 0 && s(val)) yield val;
		limit--;
	}
}

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
	return filter(l, v => !s(v), limit);
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
