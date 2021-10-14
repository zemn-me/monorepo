/**
 * For a given iterable, create a cached mapping of some selected value
 * to the values in the iterable.
 */
export function select<T, S>(
	values: Iterable<T>,
	f: (arg0: T) => S
): (v: S) => T | undefined {
	const cache = new Map<S, T>();
	for (const v of values) cache.set(f(v), v);

	return (v: S): T | undefined => cache.get(v);
}

/**
 * For a given function that may return undefined,
 * return a function that never returns undefined and instead returns
 * an error on failure.
 *
 * Optionally provide a function that produces that error.
 */
export function must<I extends unknown[], O>(
	f: (...a: I) => O | undefined,
	e?: (...a: I) => Error
): (...a: I) => O {
	return (...a: I) => {
		const r = f(...a);
		if (r === undefined) {
			throw e ? e(...a) : new Error('must');
		}

		return r;
	};
}

/**
 * For a set of functions that may throw, returns the value of the first function that does
 * not throw, or throws all erros at once.
 */
export function perhaps<T>(...fs: (() => T)[]): T {
	const errors = [];
	for (const f of fs) {
		try {
			return f();
		} catch (e) {
			errors.push(e);
		}
	}

	throw errors;
}

/**
 * For a given function whose first parameter is T, returns a new function with the same
 * airity that can take T | undefined, but where an undefined value returns an undefined output
 */
export function maybe<T, O, P extends unknown[]>(f: (v: T, ...a: P) => O) {
	return (v: T | undefined, ...a: P) => {
		if (v === undefined) return undefined;
		return f(v, ...a);
	};
}

export type Maybe<T> = T | undefined;
