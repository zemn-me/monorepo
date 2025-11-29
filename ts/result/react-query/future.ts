import { skipToken } from "@tanstack/react-query";

import * as option from "#root/ts/option/types.js";
import * as result from "#root/ts/result/result.js";

export type Future<T, E> =
	option.Option<
		result.Result<T, E>>;

export function and_then<T, E, TT>(
	f: Future<T, E>,
	then: (v: T) => TT
): Future<TT, E> {
	return option.and_then(
		f,
		r => result.and_then(
			r,
			then,
		)
	)
}

export function from_option<T>(
	v: option.Option<T>
): Future<T, never> {
	return option.and_then(v, v => result.Ok(v))
}

export function from_result<T, E>(
	v: result.Result<T, E>,
): Future<T, E> {
	return option.Some(v)
}

export function field<T, K extends keyof T, E>(
	v: Future<T, E>,
	k: K,
): Future<T[K], E> {
	return and_then(
		v,
		l => l[k]
	)
}

export function flatten<T, E, EE>(
	v: Future<Future<T, E>, EE>
): Future<T, EE | E> {
	return option.option_result_option_result_flatten(
		v
	)
}

/**
 * zip two futures. notably if either future is in
 * error, the result will always be in error.
 */
export function zipped<T, TT, E, EE, O>(
	o1: Future<T, E>,
	o2: Future<TT, EE>,
	Then: (a: T, b: TT) => O
): Future<O, EE | E> {
	// i miss pattern matching
	return option.if_else(
		o1,
		// Some(?)
		r1 => result.if_else(
			r1,
			// Some(Ok())
			ok1 => option.if_else(
				o2,
				// Some(Ok()), Some(?)
				r2 => result.if_else(
					r2,
					// Some(Ok()), Some(Ok())
					ok2 => success(Then(ok1, ok2)),
					// Some(Ok()), Some(Err())
					e => error(e)
				),
				// Some(Ok()), None
				() => pending()
			),
			// Some(Err())
			e => error(e)
		),
		// None
		() => option.if_else(
			o2,
			// None, Some(?)
			r2 => result.if_else(
				r2,
				// None, Some(Ok())
				_ok2 => pending(),
				// None, Some(Err())
				err => error(err)
			),
			// None, None
			() => pending()
		)
	)
}

export function zipped_3<T, TT, TTT, E, EE, EEE, O>(
	a: Future<T, E>,
	b: Future<TT, EE>,
	c: Future<TTT, EEE>,
	Then: (a: T, b: TT, c: TTT) => O
): Future<O, EEE | EE | E> {
	return zipped(zipped(
		a, b, (a, b) => (c: TTT) => Then(a, b, c)
	), c, (f, c) => f(c))
}

export function error<T>(v: T) {
	return option.Some(result.Err(v))
}

export function pending() {
	return option.None
}

export function success<T>(v: T) {
	return option.Some(result.Ok(v))
}

export function or_skip_query<T>(
	f: Future<T, unknown>,
): T | typeof skipToken {
	return unrap_or(f, skipToken)
}


export function unrap_or<T, V>(
	f: Future<T, unknown>,
	v: V,
): T | V{
	return option.unwrap_or(option.and_then(
		f,
		r => result.unwrap_or(r, v)
	), v);
}

export function and_then_flatten<T, TT, E, EE>(
	fut: Future<T, E>,
	f: (v: T) => Future<TT, EE>
): Future<TT, EE | E> {
	return flatten(and_then(
		fut,
		f
	))
}

export function unpack<T, E, O1, O2, O3>(
	fut: Future<T, E>,
	success: (v: T) => O1,
	failure: (v: E) => O2,
	pending: () => O3
): O1 | O2 | O3 {
	return option.if_else(
		fut,
		r => result.if_else(
			r,
			v => success(v),
			e => failure(e)
		),
		pending
	)
}


export function stringify<T, E>(
	f: Future<T, E>,
	stringifyT: (v: T) => string,
	stringifyE: (v: E) => string,
): string {
	return option.stringify(
		f,
		r => result.stringify(
			r,
			stringifyT,
			stringifyE
		)
	)
}
