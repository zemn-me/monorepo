import { and_then, None, Option, Some, unwrap_or_else } from "#root/ts/option/types.js";

/**
 * Returns all values for which {@link self}
 * is {@link Some}.
 * @param this
 */
export function* filter<T>(self: Iterable<Option<T>>): Iterable<T> {
	for (const v of self) {
		yield*
			unwrap_or_else(
				and_then(
					v,
					v => [v]
				), () => [])
	}
}

export const advance_by =
	(n: number) =>
		<T>(i: Iterator<T>) => {
			for (let ctr = 0; ctr < n; ctr++) {
				i.next()
			}
	}


export const iterable_result_to_option =
	<T>(r: IteratorResult<T, unknown>): Option<T> => r.done ?
		None : Some(r.value);



export const nth =
	(n: number) =>
	<T>(i: Iterator<T>) => {
		advance_by(n)(i);
		return iterable_result_to_option(
			i.next())

	}

export const iterator =
	<T>(v: Iterable<T>): Iterator<T> =>
	v[Symbol.iterator]()

export const fold =
	<I, R>(
	f: (previousValue: R,
		currentValue: I) => R) =>
	(initialValue: R) =>
	(i: Iterable<I>) => {
	let previousValue = initialValue;

	for (const currentValue of i) {
		previousValue = f(previousValue, currentValue);
	}

	return previousValue;
}

export const last =
	<T>(self: Iterable<T>): Option<T> =>
		fold<T, Option<T>>(
			(_, c) => Some(c)
		)(None)(self);

export const first =
	<T>(self: Iterator<T>): Option<T> =>
		nth(0)(self);

export const to_array =
	<T>(self: Iterable<T>): T[] =>
		Array.from(self);

export const to_set =
	<T>(self: Iterable<T>): Set<T> =>
		new Set(self);

export const concat =
	<T>(i: Iterable<T>) =>
		function* <TT>(ii: Iterable<TT>) {
			yield* i;
			yield* ii;
	}


export function* map<I, O>(i: Iterable<I>, f: (i: I) => O): Iterable<O> {
	for (const it of i) yield f(it);
}

export function* range(start = 0, end = Infinity, step = 1) {
	for (let i = start; i < end; i += step) {
		yield i;
	}
}
